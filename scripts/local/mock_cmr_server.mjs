#!/usr/bin/env node

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

/**
 * Local mock CMR server for the metadata-correction smoke flow.
 *
 * This server gives the local SNS/SQS bridge something lightweight to talk to instead of a
 * real CMR deployment. It loads one JSON fixture into memory, exposes a small subset of the
 * CMR search routes that the metadata-correction pipeline uses, and supports a local-only
 * update route so corrected UMM can be written back between events.
 *
 * In practice the flow is:
 * 1. keyword-event lookup asks which collection concept ids reference a keyword uuid
 * 2. collection lookup fetches the current UMM for that concept id
 * 3. local mock writeback updates the in-memory collection after a correction is applied
 *
 * The fixture is intentionally stateful for the lifetime of the process, which lets later
 * events observe the collection changes made by earlier events during the same smoke run.
 */
const defaultFixturePath = path.resolve(
  import.meta.dirname,
  'fixtures/metadata_correction_smoke.full_path.example.json'
)

const fixturePath = process.env.FIXTURE_FILE || process.argv[2] || defaultFixturePath
const port = Number(process.env.MOCK_CMR_PORT || 3020)

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

// Normalize scheme names before building fixture lookup keys.
const normalizeScheme = (scheme = '') => String(scheme).toLowerCase()

const cmrSchemeToKmsScheme = {
  science_keywords: 'sciencekeywords',
  platform: 'platforms',
  instrument: 'instruments',
  location_keyword: 'locations',
  data_center: 'providers'
}

const collectionConceptIdsByKeyword = new Map(
  (fixture.cmr?.collectionConceptIdsByKeyword || []).map((entry) => [
    `${normalizeScheme(entry.scheme)}:${entry.uuid}`,
    entry.conceptIds || []
  ])
)

const collectionsByConceptId = new Map(
  (fixture.cmr?.collections || []).map((collection) => [
    collection.conceptId,
    collection
  ])
)

// Keep the concept-id index in sync after local updates.
const updateCollectionIndexes = (collection) => {
  collectionsByConceptId.set(collection.conceptId, collection)
}

// Read a JSON request body for POST/PUT routes used by the local smoke server.
const readJsonBody = async (request) => new Promise((resolve, reject) => {
  const chunks = []

  request.on('data', (chunk) => chunks.push(chunk))
  request.on('error', reject)
  request.on('end', () => {
    try {
      const rawBody = Buffer.concat(chunks).toString('utf8')

      resolve(rawBody ? JSON.parse(rawBody) : {})
    } catch (error) {
      reject(error)
    }
  })
})

// Send a JSON response with any extra headers a route wants to expose.
const sendJson = (response, statusCode, body, headers = {}) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...headers
  })

  response.end(JSON.stringify(body))
}

// Send a plain-text response for unexpected server failures.
const sendText = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain'
  })

  response.end(body)
}

// Extract the first keyword uuid lookup from the mock CMR collection-search body.
const findKeywordLookup = (requestBody = {}) => {
  const condition = requestBody.condition || {}

  return Object.entries(condition).reduce((resolvedLookup, [cmrScheme, value]) => {
    if (resolvedLookup || !value?.uuid) {
      return resolvedLookup
    }

    return {
      scheme: cmrSchemeToKmsScheme[cmrScheme] || normalizeScheme(cmrScheme),
      uuid: value.uuid
    }
  }, undefined)
}

// Shape fixture collections like a minimal CMR UMM search result item.
const toUmmResultsItem = (collection) => ({
  meta: {
    'concept-id': collection.conceptId,
    'native-id': collection.nativeId,
    'provider-id': collection.providerId,
    'revision-id': collection.revisionId,
    format: collection.format
  },
  umm: collection.umm
})

/**
 * Handles the lightweight health endpoint for local smoke orchestration.
 *
 * @param {http.ServerResponse} response - The HTTP response to write to.
 * @returns {void}
 */
const handleHealthRequest = (response) => sendJson(response, 200, {
  ok: true,
  fixturePath
})

/**
 * Handles collection search requests by keyword UUID using fixture-backed mappings.
 *
 * @param {http.IncomingMessage} request - The incoming HTTP request.
 * @param {http.ServerResponse} response - The HTTP response to write to.
 * @returns {Promise<void>}
 */
const handleCollectionsSearchRequest = async (request, response) => {
  const requestBody = await readJsonBody(request)
  const lookup = findKeywordLookup(requestBody)

  if (!lookup) {
    sendJson(response, 400, {
      error: 'Missing keyword lookup condition with uuid in request body.'
    })

    return
  }

  const conceptIds = collectionConceptIdsByKeyword.get(
    `${normalizeScheme(lookup.scheme)}:${lookup.uuid}`
  ) || []

  sendJson(response, 200, {
    hits: conceptIds.length,
    items: conceptIds.map((conceptId) => ({
      meta: {
        'concept-id': conceptId
      }
    }))
  }, {
    'cmr-hits': String(conceptIds.length)
  })
}

/**
 * Handles collection lookups by concept id and returns a mock UMM search result.
 *
 * @param {URL} url - The parsed request URL containing the concept id query parameter.
 * @param {http.ServerResponse} response - The HTTP response to write to.
 * @returns {void}
 */
const handleCollectionLookupRequest = (url, response) => {
  const conceptId = url.searchParams.get('concept_id')
  const collection = collectionsByConceptId.get(conceptId)

  if (!collection) {
    sendJson(response, 404, {
      errors: [`Collection concept id not found in mock fixture: ${conceptId}`]
    })

    return
  }

  sendJson(response, 200, {
    hits: 1,
    items: [toUmmResultsItem(collection)]
  }, {
    'cmr-hits': '1'
  })
}

/**
 * Handles local-only collection updates so smoke tests can simulate post-correction ingest.
 *
 * @param {http.IncomingMessage} request - The incoming HTTP request.
 * @param {http.ServerResponse} response - The HTTP response to write to.
 * @param {string} conceptId - The collection concept id to update.
 * @returns {Promise<void>}
 */
const handleLocalCollectionUpdateRequest = async (request, response, conceptId) => {
  const collection = collectionsByConceptId.get(conceptId)

  if (!collection) {
    sendJson(response, 404, {
      errors: [`Collection concept id not found in mock fixture: ${conceptId}`]
    })

    return
  }

  const requestBody = await readJsonBody(request)

  collection.umm = requestBody.umm || collection.umm
  collection.revisionId = Number(collection.revisionId || 0) + 1

  updateCollectionIndexes(collection)

  sendJson(response, 200, {
    updated: true,
    collectionConceptId: collection.conceptId,
    nativeId: collection.nativeId,
    providerId: collection.providerId,
    revisionId: collection.revisionId
  })
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`)

    console.log(`[mock-cmr] ${request.method} ${url.pathname}${url.search}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      handleHealthRequest(response)

      return
    }

    if (request.method === 'POST' && url.pathname === '/search/collections') {
      await handleCollectionsSearchRequest(request, response)

      return
    }

    if (request.method === 'GET' && url.pathname === '/search/collections') {
      handleCollectionLookupRequest(url, response)

      return
    }

    const localCollectionUpdateMatch = request.method === 'PUT'
      && url.pathname.match(/^\/local\/collections\/([^/]+)$/)

    if (localCollectionUpdateMatch) {
      const conceptId = decodeURIComponent(localCollectionUpdateMatch[1])

      await handleLocalCollectionUpdateRequest(request, response, conceptId)

      return
    }

    sendJson(response, 404, {
      error: `Unhandled mock CMR route: ${request.method} ${url.pathname}`
    })
  } catch (error) {
    console.error('[mock-cmr] Request failed', error)

    sendText(response, 500, error.message)
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[mock-cmr] Listening on http://127.0.0.1:${port}`)
  console.log(`[mock-cmr] Using fixture ${fixturePath}`)
})
