// CreateCsv.test.js
import {
  describe,
  it,
  expect,
  vi
} from 'vitest'
import { stringify } from 'csv'
import createCsv from '../createCsv'

// Mock the csv module
vi.mock('csv', () => ({
  stringify: vi.fn()
}))

describe('createCsv', () => {
  it('should create a CSV string from a 2D array', async () => {
    const input = [
      ['Name', 'Age', 'City'],
      ['John Doe', '30', 'New York'],
      ['Jane Smith', '25', 'London']
    ]
    const expectedOutput = '"Name","Age","City"\n"John Doe","30","New York"\n"Jane Smith","25","London"\n'

    stringify.mockImplementation((values, options, callback) => {
      callback(null, expectedOutput)
    })

    const result = await createCsv(input)
    expect(result).toBe(expectedOutput)
    expect(stringify).toHaveBeenCalledWith(input, { quoted: true }, expect.any(Function))
  })

  it('should handle empty input', async () => {
    const input = []
    const expectedOutput = ''

    stringify.mockImplementation((values, options, callback) => {
      callback(null, expectedOutput)
    })

    const result = await createCsv(input)
    expect(result).toBe(expectedOutput)
    expect(stringify).toHaveBeenCalledWith(input, { quoted: true }, expect.any(Function))
  })

  it('should handle single row input', async () => {
    const input = [['Single', 'Row', 'Test']]
    const expectedOutput = '"Single","Row","Test"\n'

    stringify.mockImplementation((values, options, callback) => {
      callback(null, expectedOutput)
    })

    const result = await createCsv(input)
    expect(result).toBe(expectedOutput)
    expect(stringify).toHaveBeenCalledWith(input, { quoted: true }, expect.any(Function))
  })

  it('should reject when stringify returns an error', async () => {
    const input = [['Error', 'Test']]
    const expectedError = new Error('Stringify error')

    stringify.mockImplementation((values, options, callback) => {
      callback(expectedError, null)
    })

    await expect(createCsv(input)).rejects.toThrow('Stringify error')
    expect(stringify).toHaveBeenCalledWith(input, { quoted: true }, expect.any(Function))
  })
})
