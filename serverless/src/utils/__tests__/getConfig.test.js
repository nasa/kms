import { getApplicationConfig } from '../getConfig'
import staticConfig from '../../../../static.config.json'

describe('getConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
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

      test('includes dynamically generated sparqlEndpoint', () => {
        process.env.RDF4J_SERVICE_URL = 'http://test-rdf4j-service'

        const applicationConfig = getApplicationConfig()

        expect(applicationConfig.sparqlEndpoint).toBe('http://test-rdf4j-service/rdf4j-server/repositories/kms')
      })

      test('updates sparqlEndpoint when RDF4J_SERVICE_URL changes', () => {
        process.env.RDF4J_SERVICE_URL = 'http://test-rdf4j-service-1'
        const config1 = getApplicationConfig()
        expect(config1.sparqlEndpoint).toBe('http://test-rdf4j-service-1/rdf4j-server/repositories/kms')

        process.env.RDF4J_SERVICE_URL = 'http://test-rdf4j-service-2'
        const config2 = getApplicationConfig()
        expect(config2.sparqlEndpoint).toBe('http://test-rdf4j-service-2/rdf4j-server/repositories/kms')
      })
    })
  })
})
