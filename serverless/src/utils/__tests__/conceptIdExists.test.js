import conceptIdExists from '../conceptIdExists'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../sparqlRequest')

describe('conceptIdExists', () => {
  const mockConceptIRI = 'http://example.com/concept/123'

  describe('if the identifier exists', () => {
    test('returns true', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [{
              s: 'someSubject',
              p: 'someProperty',
              o: 'someObject'
            }]
          }
        }),
        status: 200
      })

      const result = await conceptIdExists(mockConceptIRI)
      expect(result).toBe(true)
    })
  })

  describe('if the identifier does not exist', () => {
    test('returns false', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: { bindings: [] }
        })
      })

      const result = await conceptIdExists(mockConceptIRI)
      expect(result).toBe(false)
    })
  })

  describe('if error determining the identifier exists', () => {
    test('throws an error', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error')
      })

      await expect(conceptIdExists(mockConceptIRI)).rejects.toThrow(
        'Error checking concept existence: 500. Internal Server Error'
      )
    })
  })
})
