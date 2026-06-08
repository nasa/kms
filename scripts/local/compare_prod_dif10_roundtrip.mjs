#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Local DIF10 roundtrip / validate / ingest helper.
 *
 * Default behavior:
 * - fetch the collection's current `.native` XML from CMR
 * - apply one local DIF10 provider correction
 * - write the original and corrected XML to `tmp/dif10-roundtrip/`
 * - print an exact diff summary plus a `git diff --no-index` style diff
 *
 * Actions:
 * - ACTION=compare  -> fetch + mutate + diff only
 * - ACTION=validate -> also POST the corrected XML to CMR collection validation
 * - ACTION=ingest   -> also PUT the corrected XML back to CMR ingest
 *
 * Auth:
 * - set `CMR_AUTHORIZATION='Bearer ...'` to pass a full auth header through unchanged
 * - or set `CMR_TOKEN=...` / `TOKEN=...` to send `Authorization: Bearer <token>`
 * - set `CMR_VALIDATE_KEYWORDS=true` to opt into `Cmr-Validate-Keywords: true`
 *   during CMR validate/ingest requests; default is off, so the header is omitted
 *
 * Common examples:
 *   npx vite-node --config vite.config.js scripts/local/compare_prod_dif10_roundtrip.mjs
 *
 *   CMR_BASE_URL='https://cmr.sit.earthdata.nasa.gov' \
 *   ACTION=compare \
 *   npx vite-node --config vite.config.js scripts/local/compare_prod_dif10_roundtrip.mjs
 *
 *   CMR_BASE_URL='https://cmr.sit.earthdata.nasa.gov' \
 *   TOKEN='...' \
 *   ACTION=validate \
 *   npx vite-node --config vite.config.js scripts/local/compare_prod_dif10_roundtrip.mjs
 *
 *   CMR_BASE_URL='https://cmr.sit.earthdata.nasa.gov' \
 *   TOKEN='...' \
 *   CMR_VALIDATE_KEYWORDS=true \
 *   ACTION=ingest \
 *   npx vite-node --config vite.config.js scripts/local/compare_prod_dif10_roundtrip.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const outputDir = path.resolve(rootDir, 'tmp/dif10-roundtrip')

const isTrue = (value = '') => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())

// Override these with env vars when you want to target a different record or CMR environment.
const conceptId = process.env.CONCEPT_ID || 'C2244302458-AMD_KOPRI'
const cmrBaseUrl = process.env.CMR_BASE_URL || 'https://cmr.earthdata.nasa.gov'
const action = String(process.env.ACTION || 'compare').toLowerCase()
const bearerToken = process.env.CMR_TOKEN || process.env.TOKEN || ''
const explicitAuthorization = process.env.CMR_AUTHORIZATION || ''
const validateKeywords = isTrue(process.env.CMR_VALIDATE_KEYWORDS)
const oldShortName = process.env.OLD_SHORT_NAME || 'KPDC'
const newShortName = process.env.NEW_SHORT_NAME || oldShortName
const newLongName = process.env.NEW_LONG_NAME || 'National Snow and Ice Data Center'

const originalPath = path.resolve(outputDir, `${conceptId}.original.native.xml`)
const correctedPath = path.resolve(outputDir, `${conceptId}.corrected.native.xml`)
const validateResponsePath = path.resolve(outputDir, `${conceptId}.validate.response.txt`)
const ingestResponsePath = path.resolve(outputDir, `${conceptId}.ingest.response.txt`)

// Build request headers for both search and ingest endpoints, with optional auth passthrough.
const createRequestHeaders = ({
  contentType,
  accept,
  validateKeywordsHeader = false
} = {}) => {
  const headers = {}

  if (accept) {
    headers.Accept = accept
  }

  if (contentType) {
    headers['Content-Type'] = contentType
  }

  if (validateKeywordsHeader) {
    headers['Cmr-Validate-Keywords'] = 'true'
  }

  if (explicitAuthorization) {
    headers.Authorization = explicitAuthorization
  } else if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`
  }

  return headers
}

// Resolve provider-id / native-id from the concept id so the script can later validate or ingest
// without requiring those values to be supplied manually.
const parseSearchCollectionMetadata = async () => {
  const searchUrl = `${cmrBaseUrl}/search/collections.umm_json?concept_id=${encodeURIComponent(conceptId)}&page_size=1`
  const response = await fetch(searchUrl, {
    headers: createRequestHeaders({
      accept: 'application/vnd.nasa.cmr.umm_results+json'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch collection search metadata from ${searchUrl}: HTTP ${response.status}`)
  }

  const responseBody = await response.json()
  const item = responseBody?.items?.[0]

  if (!item) {
    throw new Error(`No collection metadata found for concept id ${conceptId} via ${searchUrl}`)
  }

  return {
    providerId: item.meta?.['provider-id'],
    nativeId: item.meta?.['native-id'],
    format: item.meta?.format,
    revisionId: item.meta?.['revision-id'],
    shortName: item.umm?.ShortName,
    version: item.umm?.Version,
    entryTitle: item.umm?.EntryTitle,
    searchUrl
  }
}

// Capture the most useful response details when we validate or ingest the corrected XML.
const readResponseText = async (response) => {
  const body = await response.text()

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body
  }
}

const getFirstDifference = (left, right) => {
  const minLength = Math.min(left.length, right.length)

  for (let index = 0; index < minLength; index += 1) {
    if (left[index] !== right[index]) {
      return index
    }
  }

  return left.length === right.length ? -1 : minLength
}

const getContext = (text, index) => {
  if (index < 0) {
    return ''
  }

  const start = Math.max(0, index - 120)
  const end = Math.min(text.length, index + 180)

  return text.slice(start, end)
}

if (!['compare', 'validate', 'ingest'].includes(action)) {
  throw new Error(`Unsupported ACTION=${action}. Expected compare, validate, or ingest.`)
}

const collectionMetadata = await parseSearchCollectionMetadata()
const {
  providerId,
  nativeId,
  format
} = collectionMetadata

if (!providerId || !nativeId) {
  throw new Error(
    `Missing provider-id/native-id for concept id ${conceptId}: ${JSON.stringify(collectionMetadata)}`
  )
}

const nativeUrl = `${cmrBaseUrl}/search/concepts/${encodeURIComponent(conceptId)}.native`
const response = await fetch(nativeUrl, {
  headers: createRequestHeaders({
    accept: format || 'application/xml'
  })
})

if (!response.ok) {
  throw new Error(`Failed to fetch native metadata from ${nativeUrl}: HTTP ${response.status}`)
}

const originalXml = await response.text()

if (!originalXml) {
  throw new Error(`CMR returned an empty native payload for concept id ${conceptId}`)
}

const { applyDif10MetadataCorrections } = await import('../../serverless/src/shared/applyDif10MetadataCorrections')

// This uses the same local DIF10 delegate path as the metadata-correction service. By default we
// only change the provider long name so the diff is easy to inspect, but the env vars let us
// steer the correction when needed.
const correctionResult = await applyDif10MetadataCorrections({
  metadataPayload: originalXml,
  corrections: [
    {
      scheme: 'providers',
      action: 'replace',
      oldKeywordObject: {
        ShortName: oldShortName
      },
      newKeywordObject: {
        ShortName: newShortName
      },
      newLongName
    }
  ]
})

const correctedXml = correctionResult.correctedMetadata || ''

await fs.mkdir(outputDir, { recursive: true })
await fs.writeFile(originalPath, originalXml, 'utf8')
await fs.writeFile(correctedPath, correctedXml, 'utf8')

const firstDifferenceIndex = getFirstDifference(originalXml, correctedXml)
const exactMatch = originalXml === correctedXml
let validateResult = null
let ingestResult = null

// Use git's no-index diff mode because it produces an easy-to-read XML diff without requiring
// these temp files to be tracked in the repository.
const diffResult = spawnSync(
  'git',
  [
    'diff',
    '--no-index',
    '--unified=0',
    originalPath,
    correctedPath
  ],
  {
    encoding: 'utf8'
  }
)

if (action === 'validate' || action === 'ingest') {
  const validatePath = `/search/providers/${encodeURIComponent(providerId)}/validate/collection/${encodeURIComponent(nativeId)}`
  const validateResponse = await fetch(`${cmrBaseUrl}${validatePath}`, {
    method: 'POST',
    headers: createRequestHeaders({
      contentType: format || 'application/xml',
      accept: 'application/json',
      validateKeywordsHeader: validateKeywords
    }),
    body: correctedXml
  })

  validateResult = await readResponseText(validateResponse)
  await fs.writeFile(
    validateResponsePath,
    JSON.stringify(validateResult, null, 2),
    'utf8'
  )
}

if (action === 'ingest') {
  // CMR ingest docs: PUT /search/providers/<provider-id>/collections/<native-id>
  const ingestPath = `/search/providers/${encodeURIComponent(providerId)}/collections/${encodeURIComponent(nativeId)}`
  const ingestResponse = await fetch(`${cmrBaseUrl}${ingestPath}`, {
    method: 'PUT',
    headers: createRequestHeaders({
      contentType: format || 'application/xml',
      accept: 'application/json',
      validateKeywordsHeader: validateKeywords
    }),
    body: correctedXml
  })

  ingestResult = await readResponseText(ingestResponse)
  await fs.writeFile(
    ingestResponsePath,
    JSON.stringify(ingestResult, null, 2),
    'utf8'
  )
}

console.log(JSON.stringify({
  conceptId,
  action,
  cmrBaseUrl,
  validateKeywords,
  providerId,
  nativeId,
  format,
  nativeUrl,
  collectionMetadata,
  originalPath,
  correctedPath,
  validateResponsePath: validateResult ? validateResponsePath : null,
  ingestResponsePath: ingestResult ? ingestResponsePath : null,
  correctionCount: correctionResult.correctionCount || 0,
  exactMatch,
  firstDifferenceIndex,
  originalBytes: Buffer.byteLength(originalXml, 'utf8'),
  correctedBytes: Buffer.byteLength(correctedXml, 'utf8'),
  originalContext: getContext(originalXml, firstDifferenceIndex),
  correctedContext: getContext(correctedXml, firstDifferenceIndex),
  correction: {
    scheme: 'providers',
    oldShortName,
    newShortName,
    newLongName
  },
  validateResult: validateResult ? {
    ok: validateResult.ok,
    status: validateResult.status,
    statusText: validateResult.statusText
  } : null,
  ingestResult: ingestResult ? {
    ok: ingestResult.ok,
    status: ingestResult.status,
    statusText: ingestResult.statusText
  } : null
}, null, 2))

if (diffResult.stdout) {
  console.log('\n--- git diff --no-index ---')
  console.log(diffResult.stdout)
}

if (diffResult.stderr) {
  console.error(diffResult.stderr)
}
