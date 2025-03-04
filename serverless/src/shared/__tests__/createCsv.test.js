import * as csv from 'csv'
import {
  afterEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createCsv } from '../createCsv'

vi.mock('csv')

describe('createCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when successful', () => {
    test('should create a CSV string with metadata and headers', async () => {
      const mockStringify = vi.fn((data, options, callback) => {
        callback(null, data.map((row) => row.join(',')).join('\n'))
      })
      vi.spyOn(csv, 'stringify').mockImplementation(mockStringify)

      const csvMetadata = ['Metadata 1', 'Metadata 2']
      const csvHeaders = ['Header 1', 'Header 2']
      const values = [
        ['Value 1', 'Value 2'],
        ['Value 3', 'Value 4']
      ]

      const result = await createCsv(csvMetadata, csvHeaders, values)

      const expectedOutput = 'Metadata 1,Metadata 2\n'
        + 'Header 1,Header 2\n'
        + 'Value 1,Value 2\n'
        + 'Value 3,Value 4'

      expect(result).toBe(expectedOutput)
    })

    test('should handle empty values', async () => {
      const mockStringify = vi.fn((data, options, callback) => {
        callback(null, data.map((row) => row.join(',')).join('\n'))
      })
      vi.spyOn(csv, 'stringify').mockImplementation(mockStringify)

      const csvMetadata = ['Metadata']
      const csvHeaders = ['Header']
      const values = []

      const result = await createCsv(csvMetadata, csvHeaders, values)

      const expectedOutput = 'Metadata\n'
        + 'Header'

      expect(result).toBe(expectedOutput)
    })
  })

  describe('when unsuccessful', () => {
    test('should reject with an error if stringify fails', async () => {
      const mockStringify = vi.fn((data, options, callback) => {
        callback(new Error('Stringify error'))
      })
      vi.spyOn(csv, 'stringify').mockImplementation(mockStringify)

      const csvMetadata = ['Metadata']
      const csvHeaders = ['Header']
      const values = [['Value']]

      await expect(createCsv(csvMetadata, csvHeaders, values)).rejects.toThrow('Stringify error')
    })
  })
})
