#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_service.dif10.example.json'
)
const metadataPayloadPath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_service.dif10.example.xml'
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

assert.equal(correctionResult.correctionCount, request.corrections.length)
assert.match(correctionResult.correctedMetadata || '', /<Topic>OCEANS<\/Topic>/)
assert.match(correctionResult.correctedMetadata || '', /<Epoch>PLEISTOCENE<\/Epoch>/)
assert.match(correctionResult.correctedMetadata || '', /<Short_Name>SPOT-4-UPDATED<\/Short_Name>/)
assert.doesNotMatch(correctionResult.correctedMetadata || '', /<Short_Name>GEOPHONES<\/Short_Name>/)
assert.doesNotMatch(correctionResult.correctedMetadata || '', /<Short_Name>CEOS<\/Short_Name>/)
assert.doesNotMatch(correctionResult.correctedMetadata || '', /<Temporal_Resolution_Range>/)
assert.match(correctionResult.correctedMetadata || '', /<Product_Level_Id>1A<\/Product_Level_Id>/)

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

const ruContentTypePruneResult = await applyDif10MetadataCorrections({
  collectionConceptId: 'C1234567890-RU-PRUNE',
  nativeFormat: 'DIF10',
  metadataPayload: '<DIF><Related_URL><URL_Content_Type><Type>VIEW RELATED INFORMATION</Type><Subtype>OpenSearch</Subtype></URL_Content_Type><URL>http://example.com</URL></Related_URL></DIF>',
  corrections: [
    {
      scheme: 'rucontenttype',
      action: 'replace',
      oldKeywordPath: 'DistributionURL > VIEW RELATED INFORMATION > OpenSearch',
      newKeywordPath: ' > '
    }
  ]
})

assert.equal(ruContentTypePruneResult.correctionCount, 1)
assert.doesNotMatch(ruContentTypePruneResult.correctedMetadata || '', /<URL_Content_Type>/)
assert.match(ruContentTypePruneResult.correctedMetadata || '', /<Related_URL>/)

const removeEmptyParentResult = await applyDif10MetadataCorrections({
  collectionConceptId: 'C1234567890-RESOLUTION-PRUNE',
  nativeFormat: 'DIF10',
  metadataPayload: '<DIF><Data_Resolution><Temporal_Resolution_Range>Hourly</Temporal_Resolution_Range></Data_Resolution></DIF>',
  corrections: [
    {
      scheme: 'temporalresolutionrange',
      action: 'delete',
      oldKeywordPath: 'Hourly'
    }
  ]
})

assert.equal(removeEmptyParentResult.correctionCount, 1)
assert.doesNotMatch(removeEmptyParentResult.correctedMetadata || '', /<Data_Resolution>/)

const createNestedLongNameResult = await applyDif10MetadataCorrections({
  collectionConceptId: 'C1234567890-INSTRUMENT-LONGNAME',
  nativeFormat: 'DIF10',
  metadataPayload,
  corrections: [
    {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > SEISMIC REFLECTION PROFILERS',
      newKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > SEISMIC REFLECTION PROFILERS-UPDATED',
      newLongName: 'Seismic Reflection Profilers Updated'
    }
  ]
})

assert.equal(createNestedLongNameResult.correctionCount, 1)
assert.match(createNestedLongNameResult.correctedMetadata || '', /<Short_Name>SEISMIC REFLECTION PROFILERS-UPDATED<\/Short_Name>/)
assert.match(createNestedLongNameResult.correctedMetadata || '', /<Long_Name>Seismic Reflection Profilers Updated<\/Long_Name>/)

const createScalarResult = await applyDif10MetadataCorrections({
  collectionConceptId: 'C1234567890-SCALAR-CREATE',
  nativeFormat: 'DIF10',
  metadataPayload: '<DIF><Entry_ID><Short_Name>SCALAR_TEST</Short_Name></Entry_ID></DIF>',
  corrections: [
    {
      scheme: 'productlevelid',
      action: 'replace',
      newKeywordPath: '1A'
    }
  ]
})

assert.equal(createScalarResult.correctionCount, 1)
assert.match(createScalarResult.correctedMetadata || '', /<Product_Level_Id>1A<\/Product_Level_Id>/)

console.log('[metadata-correction-smoke] Applied corrections locally')
console.log(JSON.stringify({
  fixturePath,
  collectionConceptId: request.collectionConceptId,
  nativeFormat: request.nativeFormat,
  requestedCorrections: request.corrections.length,
  appliedCorrections: correctionResult.correctionCount || 0,
  extraCasesChecked: [
    'rucontenttype-prunes-empty-container',
    'temporalresolutionrange-prunes-empty-parent',
    'instrument-replace-creates-missing-long-name',
    'productlevelid-replace-creates-missing-scalar'
  ],
  outputPath,
  writeResult
}, null, 2))
