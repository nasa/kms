import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrGetRequest } from '../cmrGetRequest'
import { getCmrCollectionConceptIds } from '../getCmrCollectionConceptIds'
import { logger } from '../logger'

vi.mock('../cmrGetRequest')
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('getCmrCollectionConceptIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockHeaders = (cmrHits) => ({
    get: vi.fn((headerName) => {
      if (headerName === 'cmr-hits') {
        return cmrHits
      }

      return null
    })
  })

  test('should return unique collection concept ids for science keywords', async () => {
    cmrGetRequest.mockResolvedValue({
      ok: true,
      headers: mockHeaders('2'),
      json: vi.fn().mockResolvedValue({
        hits: 2,
        items: [
          { meta: { 'concept-id': 'C1000000000-PROV' } },
          { meta: { 'concept-id': 'C2000000000-PROV' } },
          { meta: { 'concept-id': 'C1000000000-PROV' } }
        ]
      })
    })

    const result = await getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0',
      keywordPath: 'EARTH SCIENCE > ATMOSPHERE > ATMOSPHERIC WINDS'
    })

    expect(result).toEqual([
      'C1000000000-PROV',
      'C2000000000-PROV'
    ])

    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections.umm_json?keyword=1234-5678-9ABC-DEF0&page_size=2000&page_num=1'
    })
  })

  test('should return unique collection concept ids for any keyword scheme because lookup is UUID driven', async () => {
    cmrGetRequest.mockResolvedValue({
      ok: true,
      headers: mockHeaders('2'),
      json: vi.fn().mockResolvedValue({
        hits: 2,
        items: [
          { meta: { 'concept-id': 'C6000000000-PROV' } },
          { meta: { 'concept-id': 'C7000000000-PROV' } },
          { meta: { 'concept-id': 'C6000000000-PROV' } }
        ]
      })
    })

    const result = await getCmrCollectionConceptIds({
      scheme: 'projects',
      uuid: 'DATA-CENTER-UUID',
      keywordPath: 'Projects > FedEO'
    })

    expect(result).toEqual([
      'C6000000000-PROV',
      'C7000000000-PROV'
    ])

    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections.umm_json?keyword=DATA-CENTER-UUID&page_size=2000&page_num=1'
    })
  })

  test('should fetch additional pages when cmr-hits exceeds the maximum page size', async () => {
    cmrGetRequest
      .mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders('2001'),
        json: vi.fn().mockResolvedValue({
          hits: 2001,
          items: [
            { meta: { 'concept-id': 'C1000000000-PROV' } },
            { meta: { 'concept-id': 'C2000000000-PROV' } }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders('2001'),
        json: vi.fn().mockResolvedValue({
          hits: 2001,
          items: [
            { meta: { 'concept-id': 'C3000000000-PROV' } }
          ]
        })
      })

    const result = await getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0',
      keywordPath: 'EARTH SCIENCE > ATMOSPHERE > ATMOSPHERIC WINDS'
    })

    expect(cmrGetRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
      path: '/search/collections.umm_json?keyword=1234-5678-9ABC-DEF0&page_size=2000&page_num=1'
    }))

    expect(cmrGetRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/search/collections.umm_json?keyword=1234-5678-9ABC-DEF0&page_size=2000&page_num=2'
    }))

    expect(result).toEqual([
      'C1000000000-PROV',
      'C2000000000-PROV',
      'C3000000000-PROV'
    ])
  })

  test('should throw when the keyword uuid is missing', async () => {
    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing keyword UUID for CMR concept-id lookup')
  })

  test('should throw when the CMR response is not ok', async () => {
    cmrGetRequest.mockResolvedValue({
      ok: false,
      headers: mockHeaders('0'),
      status: 500,
      url: 'https://cmr.earthdata.nasa.gov/search/collections.umm_json?keyword=1234&page_size=2000&page_num=1',
      text: vi.fn().mockResolvedValue('CMR unavailable')
    })

    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234'
    })).rejects.toThrow('CMR unavailable')
  })

  test('should fall back to the HTTP status when the CMR error body is empty', async () => {
    cmrGetRequest.mockResolvedValue({
      ok: false,
      headers: mockHeaders('0'),
      status: 503,
      url: 'https://cmr.earthdata.nasa.gov/search/collections.umm_json?keyword=1234&page_size=2000&page_num=1',
      text: vi.fn().mockResolvedValue('')
    })

    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234'
    })).rejects.toThrow('HTTP error! status: 503')
  })

  test('should log the number of concept ids found', async () => {
    cmrGetRequest.mockResolvedValue({
      ok: true,
      headers: mockHeaders('1'),
      json: vi.fn().mockResolvedValue({
        hits: 1,
        items: [{ meta: { 'concept-id': 'C5000000000-PROV' } }]
      })
    })

    await getCmrCollectionConceptIds({
      scheme: 'locations',
      uuid: 'UUID-1234',
      keywordPath: 'CONTINENT > ANTARCTICA'
    })

    expect(logger.info).toHaveBeenCalledWith(
      'Found CMR collection concept ids: scheme=locations uuid=UUID-1234 keywordPath=CONTINENT > ANTARCTICA count=1 totalHits=1 totalPages=1'
    )
  })

  test('should fall back to the first-page concept count when CMR omits hits and cmr-hits', async () => {
    cmrGetRequest.mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue(null)
      },
      json: vi.fn().mockResolvedValue({})
    })

    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: 'UUID-EMPTY'
    })).resolves.toEqual([])

    expect(logger.info).toHaveBeenCalledWith(
      'Found CMR collection concept ids: scheme=sciencekeywords uuid=UUID-EMPTY keywordPath=n/a count=0 totalHits=0 totalPages=1'
    )
  })

  test('should use the top-level hits value for pagination even when the cmr-hits header is missing', async () => {
    cmrGetRequest
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue(null)
        },
        json: vi.fn().mockResolvedValue({
          hits: 2001,
          items: [
            { meta: { 'concept-id': 'C1000000000-PROV' } }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue(null)
        },
        json: vi.fn().mockResolvedValue({
          hits: 2001,
          items: [
            { meta: { 'concept-id': 'C2000000000-PROV' } }
          ]
        })
      })

    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: 'UUID-HITS',
      keywordPath: 'EARTH SCIENCE > ATMOSPHERE > ATMOSPHERIC WINDS'
    })).resolves.toEqual([
      'C1000000000-PROV',
      'C2000000000-PROV'
    ])

    expect(cmrGetRequest).toHaveBeenCalledTimes(2)
  })
})
