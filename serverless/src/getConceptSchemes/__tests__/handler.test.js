import {
  describe,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getConceptSchemes from '../handler'
import * as getConfigModule from '../../utils/getConfig'
import * as getConceptSchemeDetailsModule from '../../utils/getConceptSchemeDetails'

// Mock the dependencies
vi.mock('../../utils/getConfig')
vi.mock('../../utils/getConceptSchemeDetails')

describe('getConceptSchemes', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Mock the getApplicationConfig function
    getConfigModule.getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: {
        'Access-Control-Allow-Origin': '*'
      }
    })

    // Mock the getConceptSchemeDetails function
    getConceptSchemeDetailsModule.default.mockResolvedValue([
      {
        uri: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/ChainedOperations',
        prefLabel: 'Chained Operations',
        notation: 'ChainedOperations',
        modified: '2025-01-31',
        csvHeaders: null
      },
      {
        uri: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/DataFormat',
        prefLabel: 'Data Format',
        notation: 'DataFormat',
        modified: '2025-01-31',
        csvHeaders: 'Short_Name,Long_Name,UUID'
      }
    ])
  })

  test('should return XML with concept schemes', async () => {
    const result = await getConceptSchemes()

    expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*')

    const xmlString = result.body
    expect(xmlString).toContain('<schemes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd">')
    expect(xmlString).toContain('<scheme updateDate="2025-01-31" longName="Chained Operations" name="ChainedOperations"/>')
    expect(xmlString).toContain('<scheme updateDate="2025-01-31" longName="Data Format" name="DataFormat" csvHeaders="Short_Name,Long_Name,UUID"/>')
    expect(xmlString).toContain('</schemes>')
  })

  test('should handle errors and return a 500 status', async () => {
    getConceptSchemeDetailsModule.default.mockRejectedValue(new Error('Test error'))

    const result = await getConceptSchemes()

    expect(result.statusCode).toBe(500)
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(JSON.parse(result.body).error).toContain('Test error')
  })
})
