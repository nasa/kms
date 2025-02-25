import { namespaces } from '../namespaces'

describe('namespaces', () => {
  it('should be an object', () => {
    expect(typeof namespaces).toBe('object')
  })

  it('should have the correct number of namespaces', () => {
    expect(Object.keys(namespaces).length).toBe(4)
  })

  it('should have the correct namespaces', () => {
    expect(namespaces).toHaveProperty('@xmlns:rdf')
    expect(namespaces).toHaveProperty('@xmlns:skos')
    expect(namespaces).toHaveProperty('@xmlns:gcmd')
    expect(namespaces).toHaveProperty('@xmlns:dcterms')
  })

  it('should have the correct URI for each namespace', () => {
    expect(namespaces['@xmlns:rdf']).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
    expect(namespaces['@xmlns:skos']).toBe('http://www.w3.org/2004/02/skos/core#')
    expect(namespaces['@xmlns:gcmd']).toBe('https://gcmd.earthdata.nasa.gov/kms/')
    expect(namespaces['@xmlns:dcterms']).toBe('http://purl.org/dc/terms/')
  })

  it('should have all keys starting with @xmlns:', () => {
    Object.keys(namespaces).forEach((key) => {
      expect(key.startsWith('@xmlns:')).toBe(true)
    })
  })

  it('should have all values ending with # or /', () => {
    Object.values(namespaces).forEach((value) => {
      expect(value.endsWith('#') || value.endsWith('/')).toBe(true)
    })
  })
})
