import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import {
  afterEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from '../applyEcho10MetadataCorrections'
import applyIso19115MetadataCorrections from '../applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from '../applyIsoSmapMetadataCorrections'
import { applyUmmcMetadataCorrections } from '../applyUmmcMetadataCorrections'
import { DIF10_SCHEME_EDITORS } from '../dif10DomEditor'
import { ECHO10_SCHEME_EDITORS } from '../echo10DomEditor'
import { ISO_19115_SCHEME_EDITORS } from '../Iso19115DomEditor'
import { getHistoricalConceptByKeyword } from '../redis-path-store/getHistoricalConceptByKeyword'
import { getPublishedConceptByUuid } from '../redis-path-store/getPublishedConceptByUuid'
import {
  compareKeywordCsvContent,
  createKeywordEvents
} from '../redis-path-store/getPublishKeywordEvents'
import { resolveOldKeywordConceptUuid } from '../resolveOldKeywordConceptUuid'
import { UMMC_SCHEME_EDITORS } from '../ummcDomEditor'

vi.mock('../redis-path-store/getHistoricalConceptByKeyword', () => ({
  getHistoricalConceptByKeyword: vi.fn()
}))

vi.mock('../redis-path-store/getPublishedConceptByUuid', () => ({
  getPublishedConceptByUuid: vi.fn()
}))

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
 * Reads one production-shaped generated CSV fixture for a keyword scheme.
 *
 * @param {Object} options CSV selection options.
 * @param {string} options.scheme Keyword scheme.
 * @param {'published'|'draft'} options.version Keyword version.
 * @returns {string} KMS-style CSV containing metadata, headers, and keyword records.
 */
const readGeneratedCsv = ({
  scheme,
  version
}) => readFixture(`generated/${scheme}/${version}.csv`)

/**
 * Removes CSV-only auxiliary values from a correction keyword object.
 *
 * @param {Object} [keywordObject={}] Keyword object parsed from CSV.
 * @returns {Object} Keyword object containing only the scheme hierarchy fields.
 */
const normalizeCorrectionKeywordObject = (keywordObject = {}) => Object.fromEntries(
  Object.entries(keywordObject).filter(([key]) => ![
    'DataCenterURL',
    'LongName'
  ].includes(key))
)

/**
 * Returns the stable logical portion of one generated or checked correction.
 *
 * @param {Object} correction Correction descriptor.
 * @returns {Object} Comparable correction descriptor.
 */
const normalizeCorrection = (correction) => {
  const normalizedCorrection = {
    scheme: correction.scheme,
    action: correction.action,
    oldKeywordObject: normalizeCorrectionKeywordObject(correction.oldKeywordObject)
  }

  if (correction.action === 'replace') {
    normalizedCorrection.newKeywordObject = normalizeCorrectionKeywordObject(
      correction.newKeywordObject
    )
  }

  if (correction.newLongName) {
    normalizedCorrection.newLongName = correction.newLongName
  }

  return normalizedCorrection
}

/**
 * Recursively sorts object keys so equivalent corrections have the same signature.
 *
 * @param {unknown} value Value to normalize.
 * @returns {unknown} Value with stable object-key order.
 */
const sortObjectKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value)
      .sort()
      .map((key) => [key, sortObjectKeys(value[key])]))
  }

  return value
}

/**
 * Normalizes, de-duplicates, and sorts logical corrections for comparison.
 *
 * Checked native fixtures may repeat a logical correction to update duplicate XML nodes, while
 * a published/draft CSV comparison emits one event per keyword UUID.
 *
 * @param {Object[]} corrections Corrections to normalize.
 * @returns {Object[]} Stable logical corrections.
 */
const normalizeLogicalCorrections = (corrections) => {
  const correctionsBySignature = new Map()

  corrections.forEach((correction) => {
    const normalizedCorrection = sortObjectKeys(normalizeCorrection(correction))

    correctionsBySignature.set(
      JSON.stringify(normalizedCorrection),
      normalizedCorrection
    )
  })

  return [...correctionsBySignature.entries()]
    .sort(([firstSignature], [secondSignature]) => (
      firstSignature.localeCompare(secondSignature)
    ))
    .map(([, correction]) => correction)
}

/**
 * Returns the stable identity of the keyword a correction is intended to change.
 *
 * Generated scheme CSVs are shared by all native formats, so this identity selects the
 * corrections relevant to one format without including the replacement value in the match.
 *
 * @param {Object} correction Correction descriptor.
 * @returns {string} Stable correction-selection signature.
 */
const getCorrectionSelectionSignature = (correction) => JSON.stringify(sortObjectKeys({
  scheme: correction.scheme,
  action: correction.action,
  oldKeywordObject: normalizeCorrectionKeywordObject(correction.oldKeywordObject)
}))

/**
 * Generates corrections from published/draft CSV changes and compares them with checked fixtures.
 *
 * @param {Object} options Generation scenario options.
 * @param {string} options.name Native format fixture name.
 * @param {string} options.scenarioName Correction scenario name.
 * @returns {Promise<void>}
 */
const verifyGeneratedCorrections = async ({
  name,
  scenarioName
}) => {
  const expectedCorrections = readJsonFixture(
    `${scenarioName}/${name}.corrections.json`
  ).corrections
  const schemes = [...new Set(expectedCorrections.map(({ scheme }) => scheme))]
  const keywordChanges = new Map(schemes.map((scheme) => [
    scheme,
    compareKeywordCsvContent({
      oldCsvContent: readGeneratedCsv({
        scheme,
        version: 'published'
      }),
      newCsvContent: readGeneratedCsv({
        scheme,
        version: 'draft'
      }),
      scheme
    })
  ]))
  const events = createKeywordEvents(keywordChanges)
  const eventsByUuid = Object.fromEntries(events.map((event) => [event.UUID, event]))

  vi.mocked(getHistoricalConceptByKeyword).mockImplementation(async ({ keywordValue }) => {
    const event = events.find(({ OldKeywordObject }) => OldKeywordObject === keywordValue)

    return event
      ? {
        uuid: event.UUID,
        keywordObject: event.OldKeywordObject,
        longName: event.OldKeywordObject.LongName
      }
      : undefined
  })

  vi.mocked(getPublishedConceptByUuid).mockImplementation(async ({ uuid }) => {
    const event = eventsByUuid[uuid]

    return event?.NewKeywordObject
      ? {
        uuid,
        keywordObject: event.NewKeywordObject,
        longName: event.NewKeywordObject.LongName
      }
      : undefined
  })

  const generatedCorrections = await Promise.all(events.map(async (event) => ({
    ...await resolveOldKeywordConceptUuid({
      scheme: event.Scheme,
      keywordValue: event.OldKeywordObject,
      keywordEvent: {
        eventType: event.EventType,
        scheme: event.Scheme,
        uuid: event.UUID
      }
    }),
    scheme: event.Scheme
  })))
  const expectedCorrectionSignatures = new Set(
    expectedCorrections.map(getCorrectionSelectionSignature)
  )
  const selectedGeneratedCorrections = generatedCorrections.filter((correction) => (
    expectedCorrectionSignatures.has(getCorrectionSelectionSignature(correction))
  ))

  expect(normalizeLogicalCorrections(selectedGeneratedCorrections)).toEqual(
    normalizeLogicalCorrections(expectedCorrections)
  )
}

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

afterEach(() => {
  vi.clearAllMocks()
})

describe('when publishing short-name keyword changes', () => {
  test('preserves short names and auxiliary CSV fields in keyword events', () => {
    const expectedEvents = readJsonFixture('generated/short-name-events.json')
    const expectedUuids = new Set(expectedEvents.map(({ UUID }) => UUID))
    const schemes = [...new Set(expectedEvents.map(({ Scheme }) => Scheme))]
    const keywordChanges = new Map(schemes.map((scheme) => [
      scheme,
      compareKeywordCsvContent({
        oldCsvContent: readGeneratedCsv({
          scheme,
          version: 'published'
        }),
        newCsvContent: readGeneratedCsv({
          scheme,
          version: 'draft'
        }),
        scheme
      })
    ]))
    const actualEvents = createKeywordEvents(keywordChanges)
      .filter(({ UUID }) => expectedUuids.has(UUID))
      .map(({
        EventType,
        Scheme,
        UUID,
        OldKeywordObject,
        NewKeywordObject
      }) => ({
        EventType,
        Scheme,
        UUID,
        OldKeywordObject,
        NewKeywordObject
      }))
      .sort((first, second) => first.Scheme.localeCompare(second.Scheme))

    expect(actualEvents).toEqual(expectedEvents)
  })
})

describe('when correcting UMM-C metadata', () => {
  test('matches corrections generated from published and draft CSV', async () => {
    await verifyGeneratedCorrections({
      name: 'ummc',
      scenarioName: 'updates'
    })

    await verifyGeneratedCorrections({
      name: 'ummc',
      scenarioName: 'deletions'
    })
  })

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
  test('matches corrections generated from published and draft CSV', async () => {
    await verifyGeneratedCorrections({
      name: 'dif10',
      scenarioName: 'updates'
    })

    await verifyGeneratedCorrections({
      name: 'dif10',
      scenarioName: 'deletions'
    })
  })

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
  test('matches corrections generated from published and draft CSV', async () => {
    await verifyGeneratedCorrections({
      name: 'echo10',
      scenarioName: 'updates'
    })

    await verifyGeneratedCorrections({
      name: 'echo10',
      scenarioName: 'deletions'
    })
  })

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
  test('matches corrections generated from published and draft CSV', async () => {
    await verifyGeneratedCorrections({
      name: 'iso19115',
      scenarioName: 'updates'
    })

    await verifyGeneratedCorrections({
      name: 'iso19115',
      scenarioName: 'deletions'
    })
  })

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
  test('matches corrections generated from published and draft CSV', async () => {
    await verifyGeneratedCorrections({
      name: 'isosmap',
      scenarioName: 'updates'
    })

    await verifyGeneratedCorrections({
      name: 'isosmap',
      scenarioName: 'deletions'
    })
  })

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
