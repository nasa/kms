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

/**
 * Applies one fixture-backed correction scenario and verifies the complete output.
 *
 * @param {Object} options Scenario options.
 * @param {string} options.action Expected correction action.
 * @param {Function} options.applyCorrections Native metadata correction delegate.
 * @param {string} options.extension Fixture extension.
 * @param {string} options.name Fixture format name.
 * @param {string} options.scenarioName Fixture scenario directory.
 * @param {Object} options.schemeEditors Supported scheme editors for the format.
 * @returns {Promise<void>}
 */
const verifyCorrectionScenario = async ({
  action,
  applyCorrections,
  extension,
  name,
  scenarioName,
  schemeEditors
}) => {
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
}

describe('when correcting UMM-C metadata', () => {
  test('matches the complete expected record for updates', async () => {
    await verifyCorrectionScenario({
      action: 'replace',
      applyCorrections: applyUmmcMetadataCorrections,
      extension: 'json',
      name: 'ummc',
      scenarioName: 'updates',
      schemeEditors: UMMC_SCHEME_EDITORS
    })
  })

  test('matches the complete expected record for deletions', async () => {
    await verifyCorrectionScenario({
      action: 'delete',
      applyCorrections: applyUmmcMetadataCorrections,
      extension: 'json',
      name: 'ummc',
      scenarioName: 'deletions',
      schemeEditors: UMMC_SCHEME_EDITORS
    })
  })
})

describe('when correcting DIF10 metadata', () => {
  test('matches the complete expected record for updates', async () => {
    await verifyCorrectionScenario({
      action: 'replace',
      applyCorrections: applyDif10MetadataCorrections,
      extension: 'xml',
      name: 'dif10',
      scenarioName: 'updates',
      schemeEditors: DIF10_SCHEME_EDITORS
    })
  })

  test('matches the complete expected record for deletions', async () => {
    await verifyCorrectionScenario({
      action: 'delete',
      applyCorrections: applyDif10MetadataCorrections,
      extension: 'xml',
      name: 'dif10',
      scenarioName: 'deletions',
      schemeEditors: DIF10_SCHEME_EDITORS
    })
  })
})

describe('when correcting ECHO10 metadata', () => {
  test('matches the complete expected record for updates', async () => {
    await verifyCorrectionScenario({
      action: 'replace',
      applyCorrections: applyEcho10MetadataCorrections,
      extension: 'xml',
      name: 'echo10',
      scenarioName: 'updates',
      schemeEditors: ECHO10_SCHEME_EDITORS
    })
  })

  test('matches the complete expected record for deletions', async () => {
    await verifyCorrectionScenario({
      action: 'delete',
      applyCorrections: applyEcho10MetadataCorrections,
      extension: 'xml',
      name: 'echo10',
      scenarioName: 'deletions',
      schemeEditors: ECHO10_SCHEME_EDITORS
    })
  })
})

describe('when correcting ISO19115 metadata', () => {
  test('matches the complete expected record for updates', async () => {
    await verifyCorrectionScenario({
      action: 'replace',
      applyCorrections: applyIso19115MetadataCorrections,
      extension: 'xml',
      name: 'iso19115',
      scenarioName: 'updates',
      schemeEditors: ISO_19115_SCHEME_EDITORS
    })
  })

  test('matches the complete expected record for deletions', async () => {
    await verifyCorrectionScenario({
      action: 'delete',
      applyCorrections: applyIso19115MetadataCorrections,
      extension: 'xml',
      name: 'iso19115',
      scenarioName: 'deletions',
      schemeEditors: ISO_19115_SCHEME_EDITORS
    })
  })
})

describe('when correcting ISO-SMAP metadata', () => {
  test('matches the complete expected record for updates', async () => {
    await verifyCorrectionScenario({
      action: 'replace',
      applyCorrections: applyIsoSmapMetadataCorrections,
      extension: 'xml',
      name: 'isosmap',
      scenarioName: 'updates',
      schemeEditors: ISO_19115_SCHEME_EDITORS
    })
  })

  test('matches the complete expected record for deletions', async () => {
    await verifyCorrectionScenario({
      action: 'delete',
      applyCorrections: applyIsoSmapMetadataCorrections,
      extension: 'xml',
      name: 'isosmap',
      scenarioName: 'deletions',
      schemeEditors: ISO_19115_SCHEME_EDITORS
    })
  })
})
