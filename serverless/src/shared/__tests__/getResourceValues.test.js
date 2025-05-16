import {
  describe,
  expect,
  it
} from 'vitest'

import { getResourceValues } from '../getResourceValues'

describe('getResourceValues', () => {
  describe('When given valid RDF/XML with multiple resource values', () => {
    const validXml = `
      <rdf:RDF>
        <skos:Concept>
          <skos:related rdf:resource="2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df"/>
          <skos:related rdf:resource="5c6d7e8f-9g0h-1i2j-3k4l-5m6n7o8p9q0r"/>
        </skos:Concept>
      </rdf:RDF>
    `

    it('should return an array of all resource values', () => {
      const result = getResourceValues(validXml, 'skos:related')
      expect(result).toEqual([
        '2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df',
        '5c6d7e8f-9g0h-1i2j-3k4l-5m6n7o8p9q0r'
      ])
    })
  })

  describe('When given valid RDF/XML with a single resource value', () => {
    const validXml = `
      <rdf:RDF>
        <skos:Concept>
          <skos:related rdf:resource="2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df"/>
        </skos:Concept>
      </rdf:RDF>
    `

    it('should return an array with one resource value', () => {
      const result = getResourceValues(validXml, 'skos:related')
      expect(result).toEqual(['2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df'])
    })
  })

  describe('When given valid RDF/XML with no matching elements', () => {
    const validXml = `
      <rdf:RDF>
        <skos:Concept>
          <skos:unrelated rdf:resource="2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df"/>
        </skos:Concept>
      </rdf:RDF>
    `

    it('should return an empty array', () => {
      const result = getResourceValues(validXml, 'skos:related')
      expect(result).toEqual([])
    })
  })

  describe('When given invalid XML', () => {
    const invalidXml = `
      <rdf:RDF>
        <invalid>
      </rdf:RDF>
    `

    it('should throw an error', () => {
      expect(() => getResourceValues(invalidXml, 'skos:related')).toThrow('Error extracting resource values')
    })
  })

  describe('When given XML without a skos:Concept element', () => {
    const xmlWithoutConcept = `
      <rdf:RDF>
        <skos:NotConcept>
          <skos:related rdf:resource="2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df"/>
        </skos:NotConcept>
      </rdf:RDF>
    `

    it('should throw an error', () => {
      expect(() => getResourceValues(xmlWithoutConcept, 'skos:related')).toThrow('Invalid XML: skos:Concept element not found')
    })
  })

  describe('When given valid RDF/XML with a single element that has multiple attributes', () => {
    const validXml = `
      <rdf:RDF>
        <skos:Concept>
          <skos:related rdf:resource="2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df" xml:lang="en"/>
        </skos:Concept>
      </rdf:RDF>
    `

    it('should return an array with one resource value', () => {
      const result = getResourceValues(validXml, 'skos:related')
      expect(result).toEqual(['2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df'])
    })
  })

  describe('When given valid RDF/XML with a single non-array element with resource', () => {
    const validXml = `
      <rdf:RDF>
        <skos:Concept>
          <skos:exactMatch rdf:resource="2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df"/>
        </skos:Concept>
      </rdf:RDF>
    `

    it('should return an array with one resource value', () => {
      const result = getResourceValues(validXml, 'skos:exactMatch')
      expect(result).toEqual(['2ab4ba32-0bb3-4e4e-bac6-1ff4a3baf0df'])
    })
  })

  describe('When given valid RDF/XML with a single non-array element without resource', () => {
    const validXml = `
      <rdf:RDF>
        <skos:Concept>
          <skos:exactMatch>Some text content</skos:exactMatch>
        </skos:Concept>
      </rdf:RDF>
    `

    it('should return an empty array', () => {
      const result = getResourceValues(validXml, 'skos:exactMatch')
      expect(result).toEqual([])
    })
  })
})
