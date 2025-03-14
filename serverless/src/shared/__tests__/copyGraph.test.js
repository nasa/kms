import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { copyGraph } from '../copyGraph'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('copyGraph', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Clear console mocks
    console.log = vi.fn()
    console.error = vi.fn()
  })

  describe('when requesting to copy graph', () => {
    test('should successfully copy the graph', async () => {
      // Mock successful response
      sparqlRequest.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const sourceGraphName = 'sourceGraph'
      const targetGraphName = 'targetGraph'

      await copyGraph({
        sourceGraphName,
        targetGraphName
      })

      // Check if sparqlRequest was called with correct parameters
      expect(sparqlRequest).toHaveBeenCalledWith({
        path: '/statements',
        method: 'POST',
        body: expect.stringContaining(`COPY <https://gcmd.earthdata.nasa.gov/kms/version/${sourceGraphName}>`),
        contentType: 'application/sparql-update'
      })

      // Check if success message was logged
      expect(console.log).toHaveBeenCalledWith(`Successfully copied graph from ${sourceGraphName} to ${targetGraphName}`)
    })
  })

  describe('when an error occurs', () => {
    test('should throw an error when the SPARQL request fails', async () => {
      // Mock error response
      const errorMessage = 'SPARQL update failed'
      sparqlRequest.mockRejectedValue(new Error(errorMessage))

      const sourceGraphName = 'sourceGraph'
      const targetGraphName = 'targetGraph'

      await expect(copyGraph({
        sourceGraphName,
        targetGraphName
      })).rejects.toThrow(errorMessage)

      // Check if error was logged
      expect(console.error).toHaveBeenCalledWith(
        `Error copying graph from ${sourceGraphName} to ${targetGraphName}:`,
        expect.any(Error)
      )
    })

    test('should throw an error when sparqlRequest throws an unexpected error', async () => {
      // Mock unexpected error
      const unexpectedError = new Error('Unexpected error')
      sparqlRequest.mockRejectedValue(unexpectedError)

      const sourceGraphName = 'sourceGraph'
      const targetGraphName = 'targetGraph'

      await expect(copyGraph({
        sourceGraphName,
        targetGraphName
      })).rejects.toThrow('Unexpected error')

      // Check if error was logged
      expect(console.error).toHaveBeenCalledWith(
        `Error copying graph from ${sourceGraphName} to ${targetGraphName}:`,
        unexpectedError
      )
    })
  })
})
