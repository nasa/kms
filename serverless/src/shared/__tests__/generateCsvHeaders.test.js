import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { generateCsvHeaders } from '../generateCsvHeaders'

// Mock the sparqlRequest function
vi.mock('@/shared/sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('generateCsvHeaders', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  let consoleErrorSpy
  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  test('should generate headers for 2 columns', async () => {
    // Mock the sparqlRequest response
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [{ notation: { value: 'MyScheme' } }]
        }
      })
    })

    const headers = await generateCsvHeaders('MyScheme', 'v1', 2)
    expect(headers).toEqual(['MyScheme', 'UUID'])
  })

  test('should generate headers for 5 columns', async () => {
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [{ notation: { value: 'AnotherScheme' } }]
        }
      })
    })

    const headers = await generateCsvHeaders('AnotherScheme', 'v1', 5)
    expect(headers).toEqual(['AnotherScheme', 'Level1', 'Level2', 'Level3', 'UUID'])
  })

  test('should generate headers for 3 columns', async () => {
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [{ notation: { value: 'TestScheme' } }]
        }
      })
    })

    const headers = await generateCsvHeaders('TestScheme', 'v1', 3)
    expect(headers).toEqual(['TestScheme', 'Level1', 'UUID'])
  })

  test('should handle large number of columns', async () => {
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [{ notation: { value: 'LargeScheme' } }]
        }
      })
    })

    const headers = await generateCsvHeaders('LargeScheme', 'v1', 10)
    expect(headers).toEqual([
      'LargeScheme',
      'Level1',
      'Level2',
      'Level3',
      'Level4',
      'Level5',
      'Level6',
      'Level7',
      'Level8',
      'UUID'
    ])
  })

  test('should throw an error when sparqlRequest fails', async () => {
    sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

    await expect(generateCsvHeaders('FailScheme', 'v1', 3)).rejects.toThrow('SPARQL request failed')
  })

  test('should throw an error when response is not ok', async () => {
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500
    })

    await expect(generateCsvHeaders('ErrorScheme', 'v1', 3)).rejects.toThrow('HTTP error! status: 500')
  })
})
