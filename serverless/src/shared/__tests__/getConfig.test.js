import staticConfig from '../../../../static.config.json'
import { getApplicationConfig } from '../getConfig'

describe('getConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    process.env.RDFDB_BASE_URL = 'http://test-rdfdb-service'
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('getApplicationConfig', () => {
    describe('when called', () => {
      test('returns a valid object for applicationConfig', () => {
        const applicationConfig = getApplicationConfig()

        // Test static properties
        expect(applicationConfig).toMatchObject(staticConfig.application)
      })

      test('includes dynamically generated sparqlQueryEndpoint', () => {
        const applicationConfig = getApplicationConfig()

        expect(applicationConfig.sparqlQueryEndpoint).toBe(`${process.env.RDFDB_BASE_URL}${staticConfig.application.sparqlServicePath}${staticConfig.application.sparqlQueryPath}`)
      })

      test('includes dynamically generated sparqlUpdateEndpoint', () => {
        const applicationConfig = getApplicationConfig()

        expect(applicationConfig.sparqlUpdateEndpoint).toBe(`${process.env.RDFDB_BASE_URL}${staticConfig.application.sparqlServicePath}${staticConfig.application.sparqlUpdatePath}`)
      })

      test('includes dynamically generated sparqlHealthCheckEndpoint', () => {
        const applicationConfig = getApplicationConfig()

        expect(applicationConfig.sparqlHealthCheckEndpoint).toBe(`${process.env.RDFDB_BASE_URL}${staticConfig.application.sparqlHealthCheckPath}`)
      })

      test('includes dynamically generated sparqlBaseUrl', () => {
        const applicationConfig = getApplicationConfig()

        expect(applicationConfig.sparqlBaseUrl).toBe(`${process.env.RDFDB_BASE_URL}`)
      })

      test('updates endpoints when RDFDB_BASE_URL changes', () => {
        process.env.RDFDB_BASE_URL = 'http://test-rdfdb-service-2'
        const config = getApplicationConfig()
        expect(config.sparqlQueryEndpoint).toBe(`http://test-rdfdb-service-2${staticConfig.application.sparqlServicePath}${staticConfig.application.sparqlQueryPath}`)
        expect(config.sparqlUpdateEndpoint).toBe(`http://test-rdfdb-service-2${staticConfig.application.sparqlServicePath}${staticConfig.application.sparqlUpdatePath}`)
        expect(config.sparqlHealthCheckEndpoint).toBe(`http://test-rdfdb-service-2${staticConfig.application.sparqlHealthCheckPath}`)
        expect(config.sparqlBaseUrl).toBe('http://test-rdfdb-service-2')
      })

      test('getConfig returns staticConfig', () => {
        const config = getApplicationConfig()
        expect(config).toMatchObject(staticConfig.application)
      })
    })
  })
})
