import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrGetRequest } from '@/shared/cmrGetRequest'
import { logger } from '@/shared/logger'

import { getCmrCollectionNativeMetadata } from '../getCmrCollectionNativeMetadata'

vi.mock('@/shared/cmrGetRequest', () => ({
  cmrGetRequest: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn()
  }
}))

describe('getCmrCollectionNativeMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should fetch the latest native metadata payload for a collection concept id', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/xml')
      },
      text: vi.fn().mockResolvedValue('<DIF><Entry_ID/></DIF>')
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C1234567890-PROV'
    })).resolves.toBe('<DIF><Entry_ID/></DIF>')

    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/concepts/C1234567890-PROV.native'
    })

    expect(logger.info).toHaveBeenCalledWith(
      '[metadata-correction] Fetched CMR native metadata payload '
      + 'collectionConceptId=C1234567890-PROV revisionId=latest payloadBytes=22'
    )
  })

  test('should fetch a stable revision when revision id is supplied', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/xml')
      },
      text: vi.fn().mockResolvedValue('<DIF><Entry_ID>2</Entry_ID></DIF>')
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C1234567890-PROV',
      revisionId: 42
    })).resolves.toBe('<DIF><Entry_ID>2</Entry_ID></DIF>')

    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/concepts/C1234567890-PROV/42.native'
    })
  })

  test('should reject when the collection concept id is missing', async () => {
    await expect(getCmrCollectionNativeMetadata({})).rejects.toThrow(
      'Missing collection concept id for CMR native metadata lookup'
    )

    expect(cmrGetRequest).not.toHaveBeenCalled()
  })

  test('should surface failed raw concept responses with response context', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: false,
      status: 404,
      url: 'https://cmr.example/search/concepts/C123',
      text: vi.fn().mockResolvedValue('Not Found')
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C123'
    })).rejects.toMatchObject({
      message: 'Not Found',
      status: 404,
      url: 'https://cmr.example/search/concepts/C123'
    })
  })

  test('should fall back to the http status when a failed raw concept response has no error text', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: false,
      status: 500,
      url: 'https://cmr.example/search/concepts/C500',
      text: vi.fn().mockResolvedValue('')
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C500'
    })).rejects.toMatchObject({
      message: 'HTTP error! status: 500',
      status: 500,
      url: 'https://cmr.example/search/concepts/C500'
    })
  })

  test('should reject empty native metadata responses', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/xml')
      },
      text: vi.fn().mockResolvedValue('')
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C123'
    })).rejects.toThrow(
      'Empty CMR native metadata response for collection concept id: C123'
    )
  })

  test('should parse json-native metadata payloads into objects', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/vnd.nasa.cmr.umm+json;version=1.16.2')
      },
      text: vi.fn().mockResolvedValue(JSON.stringify({
        ShortName: 'LOCAL-SMOKE'
      }))
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C1234567890-PROV'
    })).resolves.toEqual({
      ShortName: 'LOCAL-SMOKE'
    })
  })

  test('should return the native payload plus exact response content type when requested', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/vnd.nasa.cmr.umm+json;version=1.16.2; charset=utf-8')
      },
      text: vi.fn().mockResolvedValue(JSON.stringify({
        ShortName: 'LOCAL-SMOKE'
      }))
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C1234567890-PROV',
      includeResponseMetadata: true
    })).resolves.toEqual({
      metadataPayload: {
        ShortName: 'LOCAL-SMOKE'
      },
      contentType: 'application/vnd.nasa.cmr.umm+json;version=1.16.2; charset=utf-8'
    })
  })

  test('should fall back to the raw payload when json-native metadata cannot be parsed', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/vnd.nasa.cmr.umm+json')
      },
      text: vi.fn().mockResolvedValue('{not-valid-json}')
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C1234567890-PROV'
    })).resolves.toBe('{not-valid-json}')
  })

  test('should treat missing content-type headers as a non-json native payload', async () => {
    vi.mocked(cmrGetRequest).mockResolvedValue({
      ok: true,
      headers: undefined,
      text: vi.fn().mockResolvedValue('<DIF><Entry_ID>no-header</Entry_ID></DIF>')
    })

    await expect(getCmrCollectionNativeMetadata({
      collectionConceptId: 'C1234567890-PROV'
    })).resolves.toBe('<DIF><Entry_ID>no-header</Entry_ID></DIF>')
  })
})
