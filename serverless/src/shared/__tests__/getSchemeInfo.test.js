import {
  describe,
  expect,
  it
} from 'vitest'

import { getSchemeInfo } from '../getSchemeInfo'

describe('getSchemeInfo', () => {
  describe('When given valid RDF/XML', () => {
    const validRdfXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme rdf:about="https://example.com/scheme/testscheme">
          <skos:prefLabel>Test Scheme</skos:prefLabel>
        </skos:ConceptScheme>
      </rdf:RDF>
    `

    it('should return correct schemeId and schemePrefLabel', () => {
      const result = getSchemeInfo(validRdfXml)
      expect(result).toEqual({
        schemeId: 'testscheme',
        schemePrefLabel: 'Test Scheme'
      })
    })
  })

  describe('When given RDF/XML without skos:ConceptScheme', () => {
    const invalidRdfXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <rdf:Description rdf:about="https://example.com/resource">
          <rdf:type rdf:resource="http://www.w3.org/2004/02/skos/core#Concept"/>
        </rdf:Description>
      </rdf:RDF>
    `

    it('should throw an error', () => {
      expect(() => getSchemeInfo(invalidRdfXml)).toThrow('Invalid XML: skos:ConceptScheme element not found')
    })
  })

  describe('When given RDF/XML with multiple skos:ConceptScheme elements', () => {
    const multipleSchemeRdfXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme rdf:about="https://example.com/scheme/scheme1">
          <skos:prefLabel>Scheme 1</skos:prefLabel>
        </skos:ConceptScheme>
        <skos:ConceptScheme rdf:about="https://example.com/scheme/scheme2">
          <skos:prefLabel>Scheme 2</skos:prefLabel>
        </skos:ConceptScheme>
      </rdf:RDF>
    `

    it('should throw an error', () => {
      expect(() => getSchemeInfo(multipleSchemeRdfXml)).toThrow('Multiple skos:ConceptScheme elements found. Only one ConceptScheme is allowed.')
    })
  })

  describe('When given RDF/XML without rdf:about attribute', () => {
    const noAboutRdfXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme>
          <skos:prefLabel>No About Scheme</skos:prefLabel>
        </skos:ConceptScheme>
      </rdf:RDF>
    `

    it('should throw an error', () => {
      expect(() => getSchemeInfo(noAboutRdfXml)).toThrow('rdf:about attribute not found in skos:ConceptScheme element')
    })
  })

  describe('When given RDF/XML without skos:prefLabel', () => {
    const noPrefLabelRdfXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme rdf:about="https://example.com/scheme/nolabel">
        </skos:ConceptScheme>
      </rdf:RDF>
    `

    it('should return schemeId and null for schemePrefLabel', () => {
      const result = getSchemeInfo(noPrefLabelRdfXml)
      expect(result).toEqual({
        schemeId: 'nolabel',
        schemePrefLabel: null
      })
    })
  })

  describe('When given invalid XML', () => {
    const invalidXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <skos:ConceptScheme>
          <skos:prefLabel>Invalid XML</skos:prefLabel>
        </skos:ConceptScheme>
      </rdf:RDF>
    `

    it('should throw an error', () => {
      expect(() => getSchemeInfo(invalidXml)).toThrow('Error extracting scheme information:')
    })
  })

  describe('When given empty string', () => {
    it('should throw an error', () => {
      expect(() => getSchemeInfo('')).toThrow('Error extracting scheme information:')
    })
  })

  describe('When given non-string input', () => {
    it('should throw an error', () => {
      expect(() => getSchemeInfo(null)).toThrow('Error extracting scheme information:')
      expect(() => getSchemeInfo(undefined)).toThrow('Error extracting scheme information:')
      expect(() => getSchemeInfo(123)).toThrow('Error extracting scheme information:')
      expect(() => getSchemeInfo({})).toThrow('Error extracting scheme information:')
    })
  })
})
