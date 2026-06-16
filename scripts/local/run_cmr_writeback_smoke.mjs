#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)
const outputDir = path.resolve(rootDir, 'tmp/cmr-writeback-smoke')
const port = Number(process.env.MOCK_CMR_PORT || 3020)
const baseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${port}`
const startMockServer = String(process.env.START_MOCK_CMR || 'true').toLowerCase() !== 'false'

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const collection = fixture.cmr.collections[0]

const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || collection.conceptId
const providerId = process.env.PROVIDER_ID || collection.providerId
const nativeId = process.env.NATIVE_ID || collection.nativeId

const originalOutputPath = path.resolve(outputDir, `${collectionConceptId}.original.json`)
const correctedOutputPath = path.resolve(outputDir, `${collectionConceptId}.corrected.json`)
const afterNoTokenOutputPath = path.resolve(outputDir, `${collectionConceptId}.after-no-token.json`)
const afterWriteOutputPath = path.resolve(outputDir, `${collectionConceptId}.after-write.json`)

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const waitForHealth = async (healthUrl, attempt = 1) => {
  try {
    const response = await fetch(healthUrl)

    if (response.ok) {
      return
    }
  } catch {
    // Keep polling until the child server comes up.
  }

  if (attempt >= 40) {
    throw new Error(`Timed out waiting for mock CMR health endpoint: ${healthUrl}`)
  }

  await sleep(250)

  await waitForHealth(healthUrl, attempt + 1)
}

const fetchCollectionNativeMetadata = async (conceptId) => {
  const response = await fetch(`${baseUrl}/search/concepts/${encodeURIComponent(conceptId)}.native`)

  if (!response.ok) {
    throw new Error(`Failed to fetch native metadata for ${conceptId}: HTTP ${response.status}`)
  }

  const responseText = await response.text()

  return JSON.parse(responseText)
}

const fetchCollectionDetails = async (conceptId) => {
  const response = await fetch(
    `${baseUrl}/search/collections?concept_id=${encodeURIComponent(conceptId)}&page_size=1`,
    {
      headers: {
        Accept: 'application/vnd.nasa.cmr.umm_results+json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch collection details for ${conceptId}: HTTP ${response.status}`)
  }

  const responseBody = await response.json()
  const item = responseBody?.items?.[0]

  if (!item) {
    throw new Error(`No collection search result found for concept id ${conceptId}`)
  }

  return {
    conceptId: item.meta?.['concept-id'],
    nativeId: item.meta?.['native-id'],
    providerId: item.meta?.['provider-id'],
    revisionId: item.meta?.['revision-id'],
    format: item.meta?.format,
    umm: item.umm
  }
}

const createCorrectedMetadata = (originalMetadata) => {
  const correctedMetadata = structuredClone(originalMetadata)

  correctedMetadata.ShortName = `${correctedMetadata.ShortName}-UPDATED`
  correctedMetadata.Platforms[0].ShortName = 'Aqua Smoke Updated'
  correctedMetadata.ScienceKeywords[0].VariableLevel1 = ''

  return correctedMetadata
}

const assertDeepEqual = (left, right, message) => {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(message)
  }
}

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

let mockServerProcess

try {
  if (startMockServer) {
    mockServerProcess = spawn(
      process.execPath,
      [path.resolve(rootDir, 'scripts/local/mock_cmr_server.mjs'), fixturePath],
      {
        env: {
          ...process.env,
          FIXTURE_FILE: fixturePath,
          MOCK_CMR_PORT: String(port)
        },
        stdio: 'inherit'
      }
    )

    await waitForHealth(`${baseUrl}/health`)
  }

  process.env.CMR_BASE_URL = baseUrl
  process.env.CMR_WRITEBACK_PROVIDERS = process.env.CMR_WRITEBACK_PROVIDERS || providerId

  const { writeCorrectedMetadataToCmr } = await import('../../serverless/src/shared/writeCorrectedMetadataToCmr')

  const originalMetadata = await fetchCollectionNativeMetadata(collectionConceptId)
  const originalDetails = await fetchCollectionDetails(collectionConceptId)
  const correctedMetadata = createCorrectedMetadata(originalMetadata)

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(originalOutputPath, JSON.stringify(originalMetadata, null, 2), 'utf8')
  await fs.writeFile(correctedOutputPath, JSON.stringify(correctedMetadata, null, 2), 'utf8')

  delete process.env.CMR_WRITER_TOKEN
  delete process.env.CMR_WRITE_TOKEN
  delete process.env.CMR_WRITER_TOKEN_SECRET_NAME
  delete process.env.CMR_WRITE_TOKEN_SECRET_NAME

  const noTokenWriteResult = await writeCorrectedMetadataToCmr({
    collectionConceptId,
    providerId,
    nativeId,
    nativeFormat: 'UMM',
    correctedMetadata,
    correctionCount: 1,
    correctionsApplied: [{ scheme: 'platforms' }],
    source: 'local-smoke'
  })

  const afterNoTokenMetadata = await fetchCollectionNativeMetadata(collectionConceptId)
  const afterNoTokenDetails = await fetchCollectionDetails(collectionConceptId)

  await fs.writeFile(afterNoTokenOutputPath, JSON.stringify(afterNoTokenMetadata, null, 2), 'utf8')

  assert(noTokenWriteResult.ingestResult.enabled === false, 'Expected no-token writeback to be disabled')
  assertDeepEqual(
    afterNoTokenMetadata,
    originalMetadata,
    'Mock collection changed even though no writer token was configured'
  )

  assert(
    afterNoTokenDetails.revisionId === originalDetails.revisionId,
    'Revision changed even though no writer token was configured'
  )

  process.env.CMR_WRITER_TOKEN = process.env.CMR_WRITER_TOKEN || 'local-writer-token'

  const writeResult = await writeCorrectedMetadataToCmr({
    collectionConceptId,
    providerId,
    nativeId,
    nativeFormat: 'UMM',
    correctedMetadata,
    correctionCount: 1,
    correctionsApplied: [{ scheme: 'platforms' }],
    source: 'local-smoke'
  })

  const afterWriteMetadata = await fetchCollectionNativeMetadata(collectionConceptId)
  const afterWriteDetails = await fetchCollectionDetails(collectionConceptId)

  await fs.writeFile(afterWriteOutputPath, JSON.stringify(afterWriteMetadata, null, 2), 'utf8')

  assert(writeResult.ingestResult.updated === true, 'Expected writer-token writeback to update the mock collection')
  assertDeepEqual(
    afterWriteMetadata,
    correctedMetadata,
    'Mock collection did not match the corrected metadata after writeback'
  )

  assert(
    Number(afterWriteDetails.revisionId) === Number(originalDetails.revisionId) + 1,
    'Revision did not increment after writer-token writeback'
  )

  console.log('[cmr-writeback-smoke] Completed successfully')
  console.log(JSON.stringify({
    baseUrl,
    fixturePath,
    collectionConceptId,
    providerId,
    nativeId,
    originalOutputPath,
    correctedOutputPath,
    afterNoTokenOutputPath,
    afterWriteOutputPath,
    noTokenWriteResult,
    writeResult,
    originalRevisionId: originalDetails.revisionId,
    finalRevisionId: afterWriteDetails.revisionId
  }, null, 2))
} finally {
  if (mockServerProcess) {
    mockServerProcess.kill('SIGTERM')
  }
}
