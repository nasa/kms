import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrPostRequest } from '../cmrPostRequest'
import { logger } from '../logger'
import { validateCmrCollectionUmm } from '../validateCmrCollectionUmm'

vi.mock('../cmrPostRequest', () => ({
  cmrPostRequest: vi.fn()
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn()
  }
}))

describe('validateCmrCollectionUmm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should validate a collection and return an empty error list on success', async () => {
    vi.mocked(cmrPostRequest).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        warnings: []
      })
    })

    const umm = {
      ShortName: 'TEST'
    }
    const result = await validateCmrCollectionUmm({
      providerId: 'LARC_ASDC',
      nativeId: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      umm
    })

    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/ingest/providers/LARC_ASDC/validate/collection/ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      body: JSON.stringify(umm),
      contentType: 'application/vnd.nasa.cmr.umm+json',
      accept: 'application/json',
      headers: {
        'Cmr-Validate-Keywords': 'true'
      }
    })

    expect(result).toEqual({
      status: 200,
      errors: [],
      warnings: [],
      responseBody: {
        warnings: []
      }
    })

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '[metadata-correction] Validated collection UMM through CMR '
      )
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('providerId=LARC_ASDC')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('nativeId=ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('status=200')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('errorCount=0')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('warningCount=0')
    )
  })

  test('should treat an empty successful response body as an empty validation payload', async () => {
    vi.mocked(cmrPostRequest).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ''
    })

    await expect(validateCmrCollectionUmm({
      providerId: 'LARC_ASDC',
      nativeId: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      umm: {
        ShortName: 'TEST'
      }
    })).resolves.toEqual({
      status: 200,
      errors: [],
      warnings: [],
      responseBody: {}
    })
  })

  test('should return validation errors when CMR responds with status 400', async () => {
    vi.mocked(cmrPostRequest).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        errors: [
          {
            path: ['ScienceKeywords', 0],
            errors: [
              'Science keyword Category [EARTH SCIENCE] was not a valid keyword combination.'
            ]
          }
        ]
      })
    })

    const result = await validateCmrCollectionUmm({
      providerId: 'LARC_ASDC',
      nativeId: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      umm: {
        ShortName: 'TEST'
      }
    })

    expect(result).toEqual({
      status: 400,
      errors: [
        {
          path: ['ScienceKeywords', 0],
          errors: [
            'Science keyword Category [EARTH SCIENCE] was not a valid keyword combination.'
          ]
        }
      ],
      warnings: [],
      responseBody: {
        errors: [
          {
            path: ['ScienceKeywords', 0],
            errors: [
              'Science keyword Category [EARTH SCIENCE] was not a valid keyword combination.'
            ]
          }
        ]
      }
    })
  })

  test('should return validation errors when CMR responds with status 422', async () => {
    vi.mocked(cmrPostRequest).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({
        errors: [
          {
            path: ['Projects', 0],
            errors: [
              'Project short name [NOT-A-REAL-PROJECT] and long name [NOT A REAL PROJECT] was not a valid keyword combination.'
            ]
          }
        ]
      })
    })

    const result = await validateCmrCollectionUmm({
      providerId: 'LARC_ASDC',
      nativeId: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      umm: {
        ShortName: 'TEST'
      }
    })

    expect(result).toEqual({
      status: 422,
      errors: [
        {
          path: ['Projects', 0],
          errors: [
            'Project short name [NOT-A-REAL-PROJECT] and long name [NOT A REAL PROJECT] was not a valid keyword combination.'
          ]
        }
      ],
      warnings: [],
      responseBody: {
        errors: [
          {
            path: ['Projects', 0],
            errors: [
              'Project short name [NOT-A-REAL-PROJECT] and long name [NOT A REAL PROJECT] was not a valid keyword combination.'
            ]
          }
        ]
      }
    })
  })

  test('should throw on unexpected non-validation errors', async () => {
    vi.mocked(cmrPostRequest).mockResolvedValue({
      ok: false,
      status: 500,
      url: 'https://cmr.example.com/ingest/providers/PROV/validate/collection/native-id',
      text: async () => 'Internal Server Error'
    })

    await expect(validateCmrCollectionUmm({
      providerId: 'PROV',
      nativeId: 'native-id',
      umm: {
        ShortName: 'TEST'
      }
    })).rejects.toMatchObject({
      message: 'Internal Server Error',
      status: 500
    })
  })

  test('should fall back to the HTTP status for unexpected errors with an empty response body', async () => {
    vi.mocked(cmrPostRequest).mockResolvedValue({
      ok: false,
      status: 500,
      url: 'https://cmr.example.com/ingest/providers/PROV/validate/collection/native-id',
      text: async () => ''
    })

    await expect(validateCmrCollectionUmm({
      providerId: 'PROV',
      nativeId: 'native-id',
      umm: {
        ShortName: 'TEST'
      }
    })).rejects.toMatchObject({
      message: 'HTTP error! status: 500',
      status: 500
    })
  })

  test('should throw when required inputs are missing', async () => {
    await expect(validateCmrCollectionUmm({
      nativeId: 'native-id',
      umm: {}
    })).rejects.toThrow('Missing provider id for CMR collection validation')

    await expect(validateCmrCollectionUmm({
      providerId: 'PROV',
      umm: {}
    })).rejects.toThrow('Missing native id for CMR collection validation')

    await expect(validateCmrCollectionUmm({
      providerId: 'PROV',
      nativeId: 'native-id'
    })).rejects.toThrow('Missing UMM-C payload for CMR collection validation')
  })
})
