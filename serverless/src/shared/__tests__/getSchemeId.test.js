import { describe, expect } from 'vitest'

import { getSchemeId } from '../getSchemeId'

describe('getSchemeId', () => {
  describe('When given valid RDF/XML', () => {
    test('should extract the correct scheme ID', () => {
      const validRdfXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:ConceptScheme rdf:about="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords">
            <skos:prefLabel>Science Keywords</skos:prefLabel>
          </skos:ConceptScheme>
        </rdf:RDF>
      `
      expect(getSchemeId(validRdfXml)).toBe('sciencekeywords')
    })
  })

  describe('When given RDF/XML without a ConceptScheme', () => {
    test('should throw an error', () => {
      const invalidRdfXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <rdf:Description rdf:about="http://example.org/resource">
            <ex:title>Example Resource</ex:title>
          </rdf:Description>
        </rdf:RDF>
      `
      expect(() => getSchemeId(invalidRdfXml)).toThrow('Invalid XML: skos:ConceptScheme element not found')
    })
  })

  describe('When given RDF/XML with multiple ConceptSchemes', () => {
    test('should throw an error', () => {
      const multipleSchemes = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:ConceptScheme rdf:about="https://example.com/scheme1">
            <skos:prefLabel>Scheme 1</skos:prefLabel>
          </skos:ConceptScheme>
          <skos:ConceptScheme rdf:about="https://example.com/scheme2">
            <skos:prefLabel>Scheme 2</skos:prefLabel>
          </skos:ConceptScheme>
        </rdf:RDF>
      `
      expect(() => getSchemeId(multipleSchemes)).toThrow('Multiple skos:ConceptScheme elements found')
    })
  })

  describe('When given RDF/XML with ConceptScheme missing rdf:about', () => {
    test('should throw an error', () => {
      const missingAbout = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:ConceptScheme>
            <skos:prefLabel>Missing About</skos:prefLabel>
          </skos:ConceptScheme>
        </rdf:RDF>
      `
      expect(() => getSchemeId(missingAbout)).toThrow('rdf:about attribute not found in skos:ConceptScheme element')
    })
  })

  describe('When given invalid XML', () => {
    test('should throw an error', () => {
      const invalidXml = '<invalid>xml</invalid'
      expect(() => getSchemeId(invalidXml)).toThrow('Error extracting scheme ID')
    })
  })

  describe('When given an empty string', () => {
    test('should throw an error', () => {
      expect(() => getSchemeId('')).toThrow('Error extracting scheme ID')
    })
  })

  describe('When given null or undefined', () => {
    test('should throw an error for null', () => {
      expect(() => getSchemeId(null)).toThrow('Error extracting scheme ID')
    })

    test('should throw an error for undefined', () => {
      expect(() => getSchemeId(undefined)).toThrow('Error extracting scheme ID')
    })
  })

  describe('When given RDF/XML with empty rdf:about attribute', () => {
    test('should return null', () => {
      const emptyAbout = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:ConceptScheme rdf:about="">
            <skos:prefLabel>Empty About</skos:prefLabel>
          </skos:ConceptScheme>
        </rdf:RDF>
      `
      expect(getSchemeId(emptyAbout)).toBeNull()
    })
  })

  describe('When given RDF/XML with rdf:about ending in a slash', () => {
    test('should return an empty string', () => {
      const slashEndingAbout = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:ConceptScheme rdf:about="https://example.com/scheme/">
            <skos:prefLabel>Slash Ending About</skos:prefLabel>
          </skos:ConceptScheme>
        </rdf:RDF>
      `
      expect(getSchemeId(slashEndingAbout)).toBeNull()
    })
  })
})
