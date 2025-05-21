import {
  describe,
  expect,
  it
} from 'vitest'

import { ensureInScheme } from '../ensureInScheme'

// Helper function to remove all whitespace
const removeWhitespace = (str) => str.replace(/\s/g, '')

describe('ensureInScheme', () => {
  describe('When given RDF/XML without skos:inScheme', () => {
    it('should add skos:inScheme element', () => {
      const input = `
        <rdf:RDF>
          <skos:Concept>
            <skos:prefLabel>Example Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      const expected = `
        <rdf:RDF>
          <skos:Concept>
            <skos:prefLabel>Example Concept</skos:prefLabel>
            <skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/testScheme"/>
          </skos:Concept>
        </rdf:RDF>
      `
      const result = ensureInScheme(input, 'testScheme')
      expect(removeWhitespace(result)).toBe(removeWhitespace(expected))
    })
  })

  describe('When given RDF/XML with existing skos:inScheme', () => {
    it('should not modify the input', () => {
      const input = `
        <rdf:RDF>
          <skos:Concept>
            <skos:prefLabel>Example Concept</skos:prefLabel>
            <skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/existingScheme"/>
          </skos:Concept>
        </rdf:RDF>
      `
      const result = ensureInScheme(input, 'testScheme')
      expect(removeWhitespace(result)).toBe(removeWhitespace(input))
    })
  })

  describe('When given invalid RDF/XML', () => {
    it('should throw an error', () => {
      const input = `
        <rdf:RDF>
          <skos:Concept>
            <skos:prefLabel>Example Concept</skos:prefLabel>
      `
      expect(() => ensureInScheme(input, 'testScheme')).toThrow('Invalid RDF/XML: Missing </skos:Concept> closing tag')
    })
  })
})
