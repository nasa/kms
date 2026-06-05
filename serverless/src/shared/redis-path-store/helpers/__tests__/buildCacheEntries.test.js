import { buildCacheEntries } from '../buildCacheEntries'

describe('buildCacheEntries', () => {
  test('builds cache entries for primary and uuid lookup keys', () => {
    const result = buildCacheEntries({
      records: new Map([
        ['EARTH SCIENCE > ATMOSPHERE', 'uuid-1']
      ]),
      createCacheKey: (fullPath) => `full:${fullPath}`,
      createUuidCacheKey: (uuid) => `uuid:${uuid}`,
      createResponseBody: (fullPath, uuid) => ({
        uuid,
        fullPath
      })
    })

    expect(result).toEqual([
      {
        key: 'full:EARTH SCIENCE > ATMOSPHERE',
        value: JSON.stringify({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uuid: 'uuid-1',
            fullPath: 'EARTH SCIENCE > ATMOSPHERE'
          })
        })
      },
      {
        key: 'uuid:uuid-1',
        value: JSON.stringify({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uuid: 'uuid-1',
            fullPath: 'EARTH SCIENCE > ATMOSPHERE'
          })
        })
      }
    ])
  })

  test('skips records with missing keys or values and omits uuid entries when the response has no uuid', () => {
    const result = buildCacheEntries({
      records: new Map([
        ['', 'uuid-ignored'],
        ['missing-value', ''],
        ['Aqua', { longName: 'Aqua satellite' }]
      ]),
      createCacheKey: (shortName) => `short:${shortName}`,
      createUuidCacheKey: (uuid) => `uuid:${uuid}`,
      createResponseBody: (shortName, value) => ({
        fullPath: `Platforms > ${shortName}`,
        longName: value.longName
      })
    })

    expect(result).toEqual([
      {
        key: 'short:Aqua',
        value: JSON.stringify({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fullPath: 'Platforms > Aqua',
            longName: 'Aqua satellite'
          })
        })
      }
    ])
  })
})
