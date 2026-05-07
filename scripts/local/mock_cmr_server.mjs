#!/usr/bin/env node

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const defaultFixturePath = path.resolve(
  import.meta.dirname,
  'fixtures/metadata_correction_smoke.full_path.example.json'
)

const fixturePath = process.env.FIXTURE_FILE || process.argv[2] || defaultFixturePath
const port = Number(process.env.MOCK_CMR_PORT || 3020)

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

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

const collectionsByNativeId = new Map(
  (fixture.cmr?.collections || []).map((collection) => [
    `${collection.providerId}:${collection.nativeId}`,
    collection
  ])
)

const updateCollectionIndexes = (collection) => {
  collectionsByConceptId.set(collection.conceptId, collection)
  collectionsByNativeId.set(`${collection.providerId}:${collection.nativeId}`, collection)
}

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

const sendJson = (response, statusCode, body, headers = {}) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...headers
  })

  response.end(JSON.stringify(body))
}

const sendText = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain'
  })

  response.end(body)
}

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

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`)

    console.log(`[mock-cmr] ${request.method} ${url.pathname}${url.search}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, {
        ok: true,
        fixturePath
      })
    }

    if (request.method === 'POST' && url.pathname === '/search/collections') {
      const requestBody = await readJsonBody(request)
      const lookup = findKeywordLookup(requestBody)

      if (!lookup) {
        return sendJson(response, 400, {
          error: 'Missing keyword lookup condition with uuid in request body.'
        })
      }

      const conceptIds = collectionConceptIdsByKeyword.get(
        `${normalizeScheme(lookup.scheme)}:${lookup.uuid}`
      ) || []

      return sendJson(response, 200, {
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

    if (request.method === 'GET' && url.pathname === '/search/collections') {
      const conceptId = url.searchParams.get('concept_id')
      const collection = collectionsByConceptId.get(conceptId)

      if (!collection) {
        return sendJson(response, 404, {
          errors: [`Collection concept id not found in mock fixture: ${conceptId}`]
        })
      }

      return sendJson(response, 200, {
        hits: 1,
        items: [toUmmResultsItem(collection)]
      }, {
        'cmr-hits': '1'
      })
    }

    const validationMatch = request.method === 'POST'
      && url.pathname.match(/^\/ingest\/providers\/([^/]+)\/validate\/collection\/([^/]+)$/)

    if (validationMatch) {
      const providerId = decodeURIComponent(validationMatch[1])
      const nativeId = decodeURIComponent(validationMatch[2])
      const collection = collectionsByNativeId.get(`${providerId}:${nativeId}`)

      if (!collection) {
        return sendJson(response, 404, {
          errors: [`Validation target not found in mock fixture: ${providerId}/${nativeId}`]
        })
      }

      return sendJson(
        response,
        Number(collection.validation?.status || 200),
        {
          errors: collection.validation?.errors || [],
          warnings: collection.validation?.warnings || []
        }
      )
    }

    const localCollectionUpdateMatch = request.method === 'PUT'
      && url.pathname.match(/^\/local\/collections\/([^/]+)$/)

    if (localCollectionUpdateMatch) {
      const conceptId = decodeURIComponent(localCollectionUpdateMatch[1])
      const collection = collectionsByConceptId.get(conceptId)

      if (!collection) {
        return sendJson(response, 404, {
          errors: [`Collection concept id not found in mock fixture: ${conceptId}`]
        })
      }

      const requestBody = await readJsonBody(request)

      collection.umm = requestBody.umm || collection.umm
      collection.validation = requestBody.validation || {
        status: 200,
        errors: [],
        warnings: []
      }

      collection.revisionId = Number(collection.revisionId || 0) + 1

      updateCollectionIndexes(collection)

      return sendJson(response, 200, {
        updated: true,
        collectionConceptId: collection.conceptId,
        nativeId: collection.nativeId,
        providerId: collection.providerId,
        revisionId: collection.revisionId
      })
    }

    return sendJson(response, 404, {
      error: `Unhandled mock CMR route: ${request.method} ${url.pathname}`
    })
  } catch (error) {
    console.error('[mock-cmr] Request failed', error)

    return sendText(response, 500, error.message)
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[mock-cmr] Listening on http://127.0.0.1:${port}`)
  console.log(`[mock-cmr] Using fixture ${fixturePath}`)
})
