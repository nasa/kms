import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from '../applyEcho10MetadataCorrections'
import applyIso19115MetadataCorrections from '../applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from '../applyIsoSmapMetadataCorrections'
import { applyUmmcMetadataCorrections } from '../applyUmmcMetadataCorrections'
import { DIF10_SCHEME_EDITORS } from '../dif10DomEditor'
import { ECHO10_SCHEME_EDITORS } from '../echo10DomEditor'
import { ISO_19115_SCHEME_EDITORS } from '../Iso19115DomEditor'
import { UMMC_SCHEME_EDITORS } from '../ummcDomEditor'

const fixtureDirectory = join(
  __dirname,
  '../__mocks__/native_metadata_correction_mappings/end_to_end'
)

const formats = [
  {
    applyCorrections: applyUmmcMetadataCorrections,
    extension: 'json',
    label: 'UMM-C',
    name: 'ummc',
    schemeEditors: UMMC_SCHEME_EDITORS
  },
  {
    applyCorrections: applyDif10MetadataCorrections,
    extension: 'xml',
    label: 'DIF10',
    name: 'dif10',
    schemeEditors: DIF10_SCHEME_EDITORS
  },
  {
    applyCorrections: applyEcho10MetadataCorrections,
    extension: 'xml',
    label: 'ECHO10',
    name: 'echo10',
    schemeEditors: ECHO10_SCHEME_EDITORS
  },
  {
    applyCorrections: applyIso19115MetadataCorrections,
    extension: 'xml',
    label: 'ISO19115',
    name: 'iso19115',
    schemeEditors: ISO_19115_SCHEME_EDITORS
  },
  {
    applyCorrections: applyIsoSmapMetadataCorrections,
    extension: 'xml',
    label: 'ISO-SMAP',
    name: 'isosmap',
    schemeEditors: ISO_19115_SCHEME_EDITORS
  }
]

const scenarios = [
  {
    action: 'replace',
    name: 'updates'
  },
  {
    action: 'delete',
    name: 'deletions'
  }
]

/**
 * Reads one text fixture.
 *
 * @param {string} filename Fixture path relative to the end-to-end directory.
 * @returns {string} Fixture contents.
 */
const readFixture = (filename) => readFileSync(join(fixtureDirectory, filename), 'utf-8')

/**
 * Reads and parses one JSON fixture.
 *
 * @param {string} filename Fixture path relative to the end-to-end directory.
 * @returns {Object} Parsed fixture.
 */
const readJsonFixture = (filename) => JSON.parse(readFixture(filename))

/**
 * Loads native metadata in the type expected by its correction delegate.
 *
 * @param {string} name Fixture format name.
 * @param {string} extension Fixture extension.
 * @param {string} scenarioName Correction scenario name.
 * @returns {Object|string} Parsed UMM-C JSON or raw XML.
 */
const readMetadataPayload = (name, extension, scenarioName) => {
  const scenarioFilename = `${scenarioName}/${name}.before.${extension}`
  const filename = existsSync(join(fixtureDirectory, scenarioFilename))
    ? scenarioFilename
    : `${name}.before.${extension}`
  const metadata = readFixture(filename)

  return extension === 'json' ? JSON.parse(metadata) : metadata
}

/**
 * Serializes native metadata consistently with the correction delegates.
 *
 * @param {Object|string} metadata Native metadata.
 * @returns {string} Serialized metadata.
 */
const serializeMetadata = (metadata) => (
  typeof metadata === 'string'
    ? metadata.trimEnd()
    : JSON.stringify(metadata, null, 2)
)

/**
 * Returns all changed marker values supplied by one replacement.
 *
 * @param {Object} correction Replacement correction.
 * @returns {string[]} Changed values.
 */
const getChangedValues = (correction) => [
  correction.newLongName,
  ...Object.values(correction.newKeywordObject || {})
].filter((value) => typeof value === 'string' && value.includes('_CHANGED'))

/**
 * Returns all deletion marker values supplied by one deletion.
 *
 * @param {Object} correction Deletion correction.
 * @returns {string[]} Marked values to remove.
 */
const getDeletedValues = (correction) => Object.values(correction.oldKeywordObject || {})
  .filter((value) => typeof value === 'string' && value.includes('_SHOULD_DELETE'))

formats.forEach(({
  applyCorrections,
  extension,
  label,
  name,
  schemeEditors
}) => {
  describe(`when correcting ${label} metadata`, () => {
    scenarios.forEach(({ action, name: scenarioName }) => {
      test(`matches the complete expected record for ${scenarioName}`, async () => {
        const metadataPayload = readMetadataPayload(name, extension, scenarioName)
        const beforeMetadata = serializeMetadata(metadataPayload)
        const request = readJsonFixture(`${scenarioName}/${name}.corrections.json`)
        const expectedMetadata = serializeMetadata(
          extension === 'json'
            ? readJsonFixture(`${scenarioName}/${name}.after.json`)
            : readFixture(`${scenarioName}/${name}.after.xml`)
        )
        const result = await applyCorrections({
          ...request,
          metadataPayload: typeof metadataPayload === 'string'
            ? metadataPayload
            : structuredClone(metadataPayload)
        })
        const correctedSchemes = [...new Set(
          request.corrections.map(({ scheme }) => scheme)
        )].sort()
        const supportedSchemes = Object.keys(schemeEditors).sort()

        expect(request.corrections.every((correction) => correction.action === action)).toBe(true)
        expect(correctedSchemes).toEqual(supportedSchemes)
        expect(result.correctionCount).toBe(request.corrections.length)
        expect(result.correctionsApplied).toEqual(
          request.corrections.map((correction) => expect.objectContaining({
            action,
            scheme: correction.scheme
          }))
        )

        expect(result.correctedMetadata).toBe(expectedMetadata)
        expect(result.correctedMetadata).not.toBe(beforeMetadata)

        if (action === 'replace') {
          request.corrections.forEach((correction) => {
            const changedValues = getChangedValues(correction)

            expect(changedValues).not.toHaveLength(0)
            changedValues.forEach((value) => {
              expect(expectedMetadata).toContain(value)
            })
          })

          expect(beforeMetadata).not.toContain('_CHANGED')
          expect(expectedMetadata).toContain('_CHANGED')
        } else {
          request.corrections.forEach((correction) => {
            const deletedValues = getDeletedValues(correction)

            expect(deletedValues).not.toHaveLength(0)
            deletedValues.forEach((value) => {
              expect(beforeMetadata).toContain(value)
              expect(expectedMetadata).not.toContain(value)
            })
          })

          expect(beforeMetadata).toContain('_SHOULD_DELETE')
          expect(expectedMetadata).not.toContain('_SHOULD_DELETE')
        }

        if (name === 'isosmap') {
          expect(result.correctedMetadata).not.toMatch(
            /<gmi:(platform|instrument|operation)>\s*<\/gmi:\1>/
          )
        }
      })
    })
  })
})
