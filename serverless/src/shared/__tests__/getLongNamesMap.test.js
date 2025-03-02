import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getLongNamesMap } from '../getLongNamesMap'
import * as sparqlRequestModule from '../sparqlRequest'

describe('getLongNamesMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when successful', () => {
    test('should return a correct map of long names', async () => {
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: {
            bindings: [
              {
                subject: { value: 'subject1' },
                bo: { value: 'primary' }
              },
              {
                subject: { value: 'subject1' },
                bo: { value: 'longName1' }
              },
              {
                subject: { value: 'subject2' },
                bo: { value: 'longName2' }
              },
              {
                subject: { value: 'subject2' },
                bo: { value: 'longName3' }
              }
            ]
          }
        })
      })

      const result = await getLongNamesMap('testScheme')

      expect(result).toEqual({
        subject1: ['longName1'],
        subject2: ['longName2', 'longName3']
      })

      expect(sparqlRequestModule.sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        body: expect.any(String)
      })
    })

    test('should handle empty response correctly', async () => {
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: {
            bindings: []
          }
        })
      })

      const result = await getLongNamesMap('testScheme')

      expect(result).toEqual({})
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error if the response is not ok', async () => {
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
        ok: false,
        status: 400
      })

      await expect(getLongNamesMap('testScheme')).rejects.toThrow('HTTP error! status: 400')
    })

    test('should throw an error if sparqlRequest fails', async () => {
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockRejectedValue(new Error('Network error'))

      await expect(getLongNamesMap('testScheme')).rejects.toThrow('Network error')
    })
  })
})
