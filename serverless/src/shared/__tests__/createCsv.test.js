import { stringify } from 'csv'
import {
  afterEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createCsv } from '../createCsv'

vi.mock('csv', () => ({
  stringify: vi.fn()
}))

describe('createCsv', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  test('should create a valid CSV string', () => {
    stringify.mockImplementation((data, options, callback) => {
      callback(
        null,
        '"Metadata 1","Metadata 2"\n'
        + '"Header 1","Header 2","Header 3"\n'
        + '"Value 1","Value 2","Value 3"\n'
        + '"Value 4","Value 5","Value 6"\n'
      )
    })

    const csvMetadata = ['Metadata 1', 'Metadata 2']
    const csvHeaders = ['Header 1', 'Header 2', 'Header 3']
    const values = [
      ['Value 1', 'Value 2', 'Value 3'],
      ['Value 4', 'Value 5', 'Value 6']
    ]

    const result = createCsv(csvMetadata, csvHeaders, values)

    expect(result).toBe(
      '"Metadata 1","Metadata 2"\n'
      + '"Header 1","Header 2","Header 3"\n'
      + '"Value 1","Value 2","Value 3"\n'
      + '"Value 4","Value 5","Value 6"\n'
    )
  })

  test('should handle empty input', () => {
    stringify.mockImplementation((data, options, callback) => {
      callback(null, '\n')
    })

    const result = createCsv([], [], [])

    expect(result).toBe('\n')
  })

  test('should handle special characters', () => {
    stringify.mockImplementation((data, options, callback) => {
      callback(
        null,
        '"Meta,data"\n'
        + '"Head""er"\n'
        + '"Val,ue"\n'
      )
    })

    const csvMetadata = ['Meta,data']
    const csvHeaders = ['Head"er']
    const values = [['Val,ue']]

    const result = createCsv(csvMetadata, csvHeaders, values)

    expect(result).toBe(
      '"Meta,data"\n'
      + '"Head""er"\n'
      + '"Val,ue"\n'
    )
  })

  test('should return an error if stringify fails', () => {
    stringify.mockImplementation((data, options, callback) => {
      callback(new Error('Stringify failed'))
    })

    const result = createCsv(['metadata'], ['header'], [['value']])

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('Stringify failed')
  })
})
