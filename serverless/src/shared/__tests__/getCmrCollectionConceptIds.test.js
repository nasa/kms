import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrPostRequest } from '../cmrPostRequest'
import { getCmrCollectionConceptIds } from '../getCmrCollectionConceptIds'
import { logger } from '../logger'

vi.mock('../cmrPostRequest')
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
    cmrPostRequest.mockResolvedValue({
      ok: true,
      headers: mockHeaders('2'),
      json: vi.fn().mockResolvedValue({
        items: [
          { meta: { 'concept-id': 'C1000000000-PROV' } },
          { meta: { 'concept-id': 'C2000000000-PROV' } },
          { meta: { 'concept-id': 'C1000000000-PROV' } }
        ]
      })
    })

    const result = await getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(result).toEqual([
      'C1000000000-PROV',
      'C2000000000-PROV'
    ])

    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections?page_size=2000&page_num=1',
      contentType: 'application/json',
      accept: 'application/vnd.nasa.cmr.umm_results+json',
      body: JSON.stringify({
        condition: {
          science_keywords: {
            uuid: '1234-5678-9ABC-DEF0'
          }
        }
      })
    })
  })

  test('should return unique collection concept ids for providers using data center uuid lookup', async () => {
    cmrPostRequest.mockResolvedValue({
      ok: true,
      headers: mockHeaders('2'),
      json: vi.fn().mockResolvedValue({
        items: [
          { meta: { 'concept-id': 'C6000000000-PROV' } },
          { meta: { 'concept-id': 'C7000000000-PROV' } },
          { meta: { 'concept-id': 'C6000000000-PROV' } }
        ]
      })
    })

    const result = await getCmrCollectionConceptIds({
      scheme: 'providers',
      uuid: 'DATA-CENTER-UUID'
    })

    expect(result).toEqual([
      'C6000000000-PROV',
      'C7000000000-PROV'
    ])

    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections?page_size=2000&page_num=1',
      contentType: 'application/json',
      accept: 'application/vnd.nasa.cmr.umm_results+json',
      body: JSON.stringify({
        condition: {
          data_center: {
            uuid: 'DATA-CENTER-UUID'
          }
        }
      })
    })
  })

  test('should fetch additional pages when cmr-hits exceeds the maximum page size', async () => {
    cmrPostRequest
      .mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders('2001'),
        json: vi.fn().mockResolvedValue({
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
          items: [
            { meta: { 'concept-id': 'C3000000000-PROV' } }
          ]
        })
      })

    const result = await getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(cmrPostRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
      path: '/search/collections?page_size=2000&page_num=1'
    }))

    expect(cmrPostRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/search/collections?page_size=2000&page_num=2'
    }))

    expect(result).toEqual([
      'C1000000000-PROV',
      'C2000000000-PROV',
      'C3000000000-PROV'
    ])
  })

  test('should throw when the scheme is unsupported', async () => {
    await expect(getCmrCollectionConceptIds({
      scheme: 'projects',
      uuid: '1234'
    })).rejects.toThrow('Unsupported CMR concept-id lookup scheme: projects')
  })

  test('should throw when the keyword uuid is missing', async () => {
    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing keyword UUID for CMR concept-id lookup')
  })

  test('should throw when the CMR response is not ok', async () => {
    cmrPostRequest.mockResolvedValue({
      ok: false,
      headers: mockHeaders('0'),
      status: 500,
      url: 'https://cmr.earthdata.nasa.gov/search/collections',
      text: vi.fn().mockResolvedValue('CMR unavailable')
    })

    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234'
    })).rejects.toThrow('CMR unavailable')
  })

  test('should fall back to the HTTP status when the CMR error body is empty', async () => {
    cmrPostRequest.mockResolvedValue({
      ok: false,
      headers: mockHeaders('0'),
      status: 503,
      url: 'https://cmr.earthdata.nasa.gov/search/collections',
      text: vi.fn().mockResolvedValue('')
    })

    await expect(getCmrCollectionConceptIds({
      scheme: 'sciencekeywords',
      uuid: '1234'
    })).rejects.toThrow('HTTP error! status: 503')
  })

  test('should log the number of concept ids found', async () => {
    cmrPostRequest.mockResolvedValue({
      ok: true,
      headers: mockHeaders('1'),
      json: vi.fn().mockResolvedValue({
        items: [{ meta: { 'concept-id': 'C5000000000-PROV' } }]
      })
    })

    await getCmrCollectionConceptIds({
      scheme: 'locations',
      uuid: 'UUID-1234'
    })

    expect(logger.info).toHaveBeenCalledWith(
      'Found CMR collection concept ids: scheme=locations uuid=UUID-1234 count=1 totalHits=1 totalPages=1'
    )
  })

  test('should fall back to the first-page concept count when CMR omits cmr-hits and items', async () => {
    cmrPostRequest.mockResolvedValue({
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
      'Found CMR collection concept ids: scheme=sciencekeywords uuid=UUID-EMPTY count=0 totalHits=0 totalPages=1'
    )
  })
})
