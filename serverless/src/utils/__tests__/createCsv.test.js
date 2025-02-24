// CreateCsv.test.js
import {
  describe,
  expect,
  vi,
  afterEach
} from 'vitest'
import { stringify } from 'csv'
import createCsv from '../createCsv'

vi.mock('csv', () => ({
  stringify: vi.fn()
}))

describe('createCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should create a CSV string with metadata, headers, and values', async () => {
    const csvMetadata = ['Metadata 1', 'Metadata 2']
    const csvHeaders = ['Header 1', 'Header 2']
    const values = [
      ['Value 1A', 'Value 1B'],
      ['Value 2A', 'Value 2B']
    ]

    const expectedOutput = '"Metadata 1","Metadata 2"\n'
      + '"Header 1","Header 2"\n'
      + '"Value 1A","Value 1B"\n'
      + '"Value 2A","Value 2B"\n'

    stringify.mockImplementation((_, __, callback) => {
      callback(null, expectedOutput)
    })

    const result = await createCsv(csvMetadata, csvHeaders, values)

    expect(result).toBe(expectedOutput)
  })

  test('should handle empty input arrays', async () => {
    stringify.mockImplementation((_, __, callback) => {
      callback(null, '\n\n')
    })

    const result = await createCsv([], [], [])

    expect(result).toBe('\n\n')
  })

  test('should reject with an error if stringify fails', async () => {
    stringify.mockImplementation((_, __, callback) => {
      callback(new Error('Stringify error'))
    })

    await expect(createCsv([], [], [])).rejects.toThrow('Stringify error')
  })
})
