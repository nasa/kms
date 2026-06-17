#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_service.ummc.corrections.json'
)
const metadataPayloadPath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_service.ummc.example.json'
)
const outputPath = path.resolve(
  rootDir,
  'tmp/metadata_correction_service_ummc_smoke_output.json'
)

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const metadataPayload = await fs.readFile(metadataPayloadPath, 'utf8')

const { applyUmmcMetadataCorrections } = await import('../../serverless/src/shared/applyUmmcMetadataCorrections')
const { writeCorrectedMetadataToCmr } = await import('../../serverless/src/shared/writeCorrectedMetadataToCmr')

const request = {
  ...fixture,
  metadataPayload
}

const correctionResult = await applyUmmcMetadataCorrections(request)

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, correctionResult.correctedMetadata || '', 'utf8')

const writeResult = await writeCorrectedMetadataToCmr({
  collectionConceptId: request.collectionConceptId,
  nativeFormat: request.nativeFormat,
  correctedMetadata: correctionResult.correctedMetadata || '',
  correctionCount: correctionResult.correctionCount || 0,
  correctionsApplied: correctionResult.correctionsApplied || [],
  source: request.source || 'local-smoke'
})

console.log('[metadata-correction-smoke] Applied corrections locally')
console.log(JSON.stringify({
  fixturePath,
  collectionConceptId: request.collectionConceptId,
  nativeFormat: request.nativeFormat,
  requestedCorrections: request.corrections.length,
  appliedCorrections: correctionResult.correctionCount || 0,
  outputPath,
  writeResult
}, null, 2))
