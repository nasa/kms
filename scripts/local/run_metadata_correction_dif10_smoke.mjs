#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_service.dif10.example.json'
)
const metadataPayloadPath = path.resolve(
  rootDir,
  'serverless/src/shared/__mocks__/dif10.xml'
)
const outputPath = path.resolve(
  rootDir,
  'tmp/metadata_correction_smoke_output.xml'
)

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const metadataPayload = await fs.readFile(metadataPayloadPath, 'utf8')

const { applyDif10MetadataCorrections } = await import('../../serverless/src/shared/applyDif10MetadataCorrections')
const { writeCorrectedMetadataToCmr } = await import('../../serverless/src/shared/writeCorrectedMetadataToCmr')

const request = {
  ...fixture,
  metadataPayload
}

const correctionResult = await applyDif10MetadataCorrections(request)

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
