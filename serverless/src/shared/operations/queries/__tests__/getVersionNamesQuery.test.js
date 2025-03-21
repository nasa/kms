import { describe, expect } from 'vitest'

import { getVersionNamesQuery } from '../getVersionNamesQuery'

describe('getVersionNamesQuery', () => {
  test('should return the correct SPARQL query string', () => {
    const expectedQuery = `
PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT DISTINCT ?versionName
WHERE {
  GRAPH ?graph {
    ?version a gcmd:Version ;
             dcterms:created ?creationDate ;
             gcmd:versionName ?originalVersionName ;
             gcmd:versionType ?versionType .
    BIND(IF(?versionType = "published", "published", ?originalVersionName) AS ?versionName)
  }
}
ORDER BY DESC(?creationDate)
`.trim()

    const result = getVersionNamesQuery()

    expect(result.trim()).toBe(expectedQuery)
  })

  test('should include necessary prefixes', () => {
    const result = getVersionNamesQuery()

    expect(result).toContain('PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>')
    expect(result).toContain('PREFIX dcterms: <http://purl.org/dc/terms/>')
  })

  test('should select the versionName', () => {
    const result = getVersionNamesQuery()

    expect(result).toContain('SELECT DISTINCT ?versionName')
  })

  test('should include the correct graph pattern', () => {
    const result = getVersionNamesQuery()

    expect(result).toContain('?version a gcmd:Version ;')
    expect(result).toContain('dcterms:created ?creationDate ;')
    expect(result).toContain('gcmd:versionName ?originalVersionName ;')
    expect(result).toContain('gcmd:versionType ?versionType .')
  })

  test('should include BIND statement for versionName', () => {
    const result = getVersionNamesQuery()

    expect(result).toContain('BIND(IF(?versionType = "published", "published", ?originalVersionName) AS ?versionName)')
  })

  test('should order results by creation date in descending order', () => {
    const result = getVersionNamesQuery()

    expect(result).toContain('ORDER BY DESC(?creationDate)')
  })
})
