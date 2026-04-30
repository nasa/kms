import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrGetRequest } from '../cmrGetRequest'
import { getCmrCollectionUmmDetails } from '../getCmrCollectionUmmDetails'
import { logger } from '../logger'

vi.mock('../cmrGetRequest', () => ({
  cmrGetRequest: vi.fn()
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn()
  }
}))

describe('getCmrCollectionUmmDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should fetch collection UMM details from CMR search results', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            meta: {
              'concept-id': 'C1994460846-LARC_ASDC',
              'native-id': 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
              'provider-id': 'LARC_ASDC',
              format: 'application/vnd.nasa.cmr.umm+json',
              'revision-id': 726
            },
            umm: {
              ShortName: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data'
            }
          }
        ]
      })
    })

    const result = await getCmrCollectionUmmDetails({
      collectionConceptId: 'C1994460846-LARC_ASDC'
    })

    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections?concept_id=C1994460846-LARC_ASDC&page_size=1',
      accept: 'application/vnd.nasa.cmr.umm_results+json'
    })

    expect(result).toEqual({
      collectionConceptId: 'C1994460846-LARC_ASDC',
      nativeId: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      providerId: 'LARC_ASDC',
      format: 'application/vnd.nasa.cmr.umm+json',
      revisionId: 726,
      umm: {
        ShortName: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data'
      }
    })

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '[metadata-correction] Fetched CMR collection UMM details '
      )
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('collectionConceptId=C1994460846-LARC_ASDC')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('providerId=LARC_ASDC')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('nativeId=ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1')
    )
  })

  test('should fall back to the requested concept id when the response omits meta concept id', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            meta: {
              'native-id': 'native-id-1',
              'provider-id': 'PROV'
            },
            umm: {
              ShortName: 'TEST'
            }
          }
        ]
      })
    })

    await expect(getCmrCollectionUmmDetails({
      collectionConceptId: 'C123-PROV'
    })).resolves.toEqual({
      collectionConceptId: 'C123-PROV',
      nativeId: 'native-id-1',
      providerId: 'PROV',
      format: undefined,
      revisionId: undefined,
      umm: {
        ShortName: 'TEST'
      }
    })
  })

  test('should throw when collection concept id is missing', async () => {
    await expect(getCmrCollectionUmmDetails({})).rejects.toThrow(
      'Missing collection concept id for CMR UMM lookup'
    )
  })

  test('should throw when CMR returns an unsuccessful response', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: false,
      status: 404,
      url: 'https://cmr.example.com/search/collections?concept_id=missing',
      text: async () => 'Not found'
    })

    await expect(getCmrCollectionUmmDetails({
      collectionConceptId: 'missing'
    })).rejects.toMatchObject({
      message: 'Not found',
      status: 404
    })
  })

  test('should fall back to the HTTP status when the CMR error body is empty', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: false,
      status: 503,
      url: 'https://cmr.example.com/search/collections?concept_id=missing',
      text: async () => ''
    })

    await expect(getCmrCollectionUmmDetails({
      collectionConceptId: 'missing'
    })).rejects.toMatchObject({
      message: 'HTTP error! status: 503',
      status: 503
    })
  })

  test('should throw when the response is missing native id, provider id, or umm', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            meta: {
              'concept-id': 'C1994460846-LARC_ASDC'
            }
          }
        ]
      })
    })

    await expect(getCmrCollectionUmmDetails({
      collectionConceptId: 'C1994460846-LARC_ASDC'
    })).rejects.toThrow(
      'Incomplete CMR UMM lookup response for collection concept id: C1994460846-LARC_ASDC'
    )
  })

  test('should throw when the response contains no result items', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      json: async () => ({})
    })

    await expect(getCmrCollectionUmmDetails({
      collectionConceptId: 'C1994460846-LARC_ASDC'
    })).rejects.toThrow(
      'Incomplete CMR UMM lookup response for collection concept id: C1994460846-LARC_ASDC'
    )
  })
})
