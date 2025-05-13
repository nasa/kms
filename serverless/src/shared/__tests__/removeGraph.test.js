import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { removeGraph } from '../removeGraph'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('removeGraph', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Clear console mocks
    console.log = vi.fn()
    console.error = vi.fn()
  })

  describe('when requesting to remove a graph', () => {
    test('should successfully remove the graph', async () => {
      // Mock successful response
      sparqlRequest.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const graphName = 'testGraph'

      await removeGraph(graphName)

      // Check if sparqlRequest was called with correct parameters
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        body: expect.stringContaining(`DROP GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/${graphName}>`),
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json'
      })

      // Check if success message was logged
      expect(console.log).toHaveBeenCalledWith(`Successfully removed graph: ${graphName}`)
    })
  })

  describe('when an error occurs', () => {
    test('should throw an error when the SPARQL request fails', async () => {
      // Mock error response
      const errorMessage = 'SPARQL update failed'
      sparqlRequest.mockRejectedValue(new Error(errorMessage))

      const graphName = 'testGraph'

      await expect(removeGraph(graphName)).rejects.toThrow(errorMessage)

      // Check if error was logged
      expect(console.error).toHaveBeenCalledWith(
        `Error removing graph ${graphName}:`,
        expect.any(Error)
      )
    })

    test('should throw an error when sparqlRequest throws an unexpected error', async () => {
      // Mock unexpected error
      const unexpectedError = new Error('Unexpected error')
      sparqlRequest.mockRejectedValue(unexpectedError)

      const graphName = 'testGraph'

      await expect(removeGraph(graphName)).rejects.toThrow('Unexpected error')

      // Check if error was logged
      expect(console.error).toHaveBeenCalledWith(
        `Error removing graph ${graphName}:`,
        unexpectedError
      )
    })
  })

  describe('edge cases', () => {
    test('should handle empty graph name', async () => {
      const graphName = ''

      await removeGraph(graphName)

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        body: expect.stringContaining(`DROP GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/${graphName}>`),
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json'
      })
    })

    test('should handle special characters in graph name', async () => {
      const graphName = 'test/graph#123'

      await removeGraph(graphName)

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        body: expect.stringContaining(`DROP GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/${graphName}>`),
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json'
      })
    })
  })
})
