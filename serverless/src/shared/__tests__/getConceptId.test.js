import { describe, expect } from 'vitest'

import { getConceptId } from '../getConceptId'

describe('getConceptId', () => {
  describe('when successful', () => {
    test('should extract concept ID from valid RDF/XML', () => {
      const validXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/123">
            <skos:prefLabel>Test Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(getConceptId(validXml)).toBe('123')
    })

    test('should return null for empty concept ID', () => {
      const emptyIdXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/">
            <skos:prefLabel>Test Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(getConceptId(emptyIdXml)).toBe(null)
    })

    test('should handle concept ID with special characters', () => {
      const specialCharsXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/test_123-456">
            <skos:prefLabel>Test Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(getConceptId(specialCharsXml)).toBe('test_123-456')
    })

    test('should handle concept ID with query parameters', () => {
      const queryParamXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/789?version=1.0">
            <skos:prefLabel>Test Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(getConceptId(queryParamXml)).toBe('789?version=1.0')
    })

    test('should handle concept ID with fragment identifier', () => {
      const fragmentXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/101#section1">
            <skos:prefLabel>Test Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(getConceptId(fragmentXml)).toBe('101#section1')
    })

    test('should handle concept ID with encoded characters', () => {
      const encodedXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/test%20concept">
            <skos:prefLabel>Test Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(getConceptId(encodedXml)).toBe('test%20concept')
    })
  })

  describe('when unsuccessful', () => {
    test('should throw error for missing skos:Concept element', () => {
      const noConceptXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Collection>
            <skos:prefLabel>Test Collection</skos:prefLabel>
          </skos:Collection>
        </rdf:RDF>
      `
      expect(() => getConceptId(noConceptXml)).toThrow('Invalid XML: skos:Concept element not found')
    })

    test('should throw error for missing rdf:about attribute', () => {
      const noAboutXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept>
            <skos:prefLabel>Test Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(() => getConceptId(noAboutXml)).toThrow('rdf:about attribute not found in skos:Concept element')
    })

    test('should throw error for invalid XML', () => {
      const invalidXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <skos:Concept>
            <skos:prefLabel>Incomplete XML
      `
      expect(() => getConceptId(invalidXml)).toThrow('Error extracting concept ID:')
    })

    test('should throw error for multiple skos:Concept elements', () => {
      const multiConceptXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/123">
            <skos:prefLabel>First Concept</skos:prefLabel>
          </skos:Concept>
          <skos:Concept rdf:about="https://gcmd.earthdata.nasa.gov/kms/concept/456">
            <skos:prefLabel>Second Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      expect(() => getConceptId(multiConceptXml)).toThrow('Multiple skos:Concept elements found. Only one concept is allowed.')
    })
  })
})
