import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach
} from 'vitest'
import deleteAll from '../handler'
import deleteAllTriples from '../../utils/deleteAllTriples'
import { getApplicationConfig } from '../../utils/getConfig'

// Mock the dependencies
vi.mock('../../utils/deleteAllTriples')
vi.mock('../../utils/getConfig')

describe('deleteAll', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })

    // Set up spies for console.log and console.error
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore the original console methods after each test
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should successfully delete all triples and return 200', async () => {
    deleteAllTriples.mockResolvedValue({ ok: true })

    const result = await deleteAll()

    expect(deleteAllTriples).toHaveBeenCalled()
    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully deleted everything.' }),
      headers: mockDefaultHeaders
    })

    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully deleted everything')
  })

  it('should handle errors from deleteAllTriples and return 500', async () => {
    deleteAllTriples.mockResolvedValue({
      ok: false,
      status: 500
    })

    const result = await deleteAll()

    expect(deleteAllTriples).toHaveBeenCalled()
    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting everything',
        error: 'HTTP error! status: 500'
      }),
      headers: mockDefaultHeaders
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting everything:', expect.any(Error))
  })

  it('should handle unexpected errors and return 500', async () => {
    const error = new Error('Unexpected error')
    deleteAllTriples.mockRejectedValue(error)

    const result = await deleteAll()

    expect(deleteAllTriples).toHaveBeenCalled()
    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting everything',
        error: 'Unexpected error'
      }),
      headers: mockDefaultHeaders
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting everything:', error)
  })
})
