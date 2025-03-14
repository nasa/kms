import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { renameGraph } from '../renameGraph'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('renameGraph', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Clear console mocks
    console.log = vi.fn()
    console.error = vi.fn()
  })

  describe('when requesting to rename graph', () => {
    test('should successfully rename the graph', async () => {
      // Mock successful response
      sparqlRequest.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const oldGraphName = 'oldGraph'
      const newGraphName = 'newGraph'

      await renameGraph({
        oldGraphName,
        newGraphName
      })

      // Check if sparqlRequest was called with correct parameters
      expect(sparqlRequest).toHaveBeenCalledWith({
        path: '/statements',
        method: 'POST',
        body: expect.stringContaining(`MOVE <https://gcmd.earthdata.nasa.gov/kms/version/${oldGraphName}>`),
        contentType: 'application/sparql-update'
      })

      // Check if success message was logged
      expect(console.log).toHaveBeenCalledWith(`Successfully renamed graph from ${oldGraphName} to ${newGraphName}`)
    })
  })

  describe('when an error occurs', () => {
    test('should throw an error when the SPARQL request fails', async () => {
      // Mock error response
      const errorMessage = 'SPARQL update failed'
      sparqlRequest.mockRejectedValue(new Error(errorMessage))

      const oldGraphName = 'oldGraph'
      const newGraphName = 'newGraph'

      await expect(renameGraph({
        oldGraphName,
        newGraphName
      })).rejects.toThrow(errorMessage)

      // Check if error was logged
      expect(console.error).toHaveBeenCalledWith(
        `Error renaming graph from ${oldGraphName} to ${newGraphName}:`,
        expect.any(Error)
      )
    })

    test('should throw an error when sparqlRequest throws an unexpected error', async () => {
      // Mock unexpected error
      const unexpectedError = new Error('Unexpected error')
      sparqlRequest.mockRejectedValue(unexpectedError)

      const oldGraphName = 'oldGraph'
      const newGraphName = 'newGraph'

      await expect(renameGraph({
        oldGraphName,
        newGraphName
      })).rejects.toThrow('Unexpected error')

      // Check if error was logged
      expect(console.error).toHaveBeenCalledWith(
        `Error renaming graph from ${oldGraphName} to ${newGraphName}:`,
        unexpectedError
      )
    })
  })
})
