import { getApplicationConfig } from '../getConfig'

describe('getConfig', () => {
  describe('when applicationConfig is called', () => {
    test('returns a valid json object for applicationConfig', () => {
      const expectedApplicationConfig = {
        apiHost: 'http://localhost:4001/dev',
        version: 'development'
      }

      const applicationConfig = getApplicationConfig()

      expect(applicationConfig).toMatchObject(expectedApplicationConfig)
    })
  })
})
