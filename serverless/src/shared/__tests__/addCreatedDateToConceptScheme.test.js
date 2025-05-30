import { XMLParser } from 'fast-xml-parser'
import { describe, expect } from 'vitest'

import { addCreatedDateToConceptScheme } from '../addCreatedDateToConceptScheme'

describe('addCreatedDateToConceptScheme', () => {
  describe('When given RDF/XML without a dcterms:created element', () => {
    test('should add a dcterms:created element with the current date', () => {
      const inputRdf = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:skos="http://www.w3.org/2004/02/skos/core#"
                 xmlns:dcterms="http://purl.org/dc/terms/">
          <skos:ConceptScheme rdf:about="http://example.com/scheme">
            <skos:prefLabel>Example Scheme</skos:prefLabel>
          </skos:ConceptScheme>
        </rdf:RDF>
      `
      const result = addCreatedDateToConceptScheme(inputRdf)
      expect(result).toContain('<dcterms:created>')
      expect(result).toMatch(/<dcterms:created>\d{4}-\d{2}-\d{2}<\/dcterms:created>/)
    })
  })

  describe('When given RDF/XML with an existing dcterms:created element', () => {
    test('should not modify the input', () => {
      const inputRdf = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:skos="http://www.w3.org/2004/02/skos/core#"
                 xmlns:dcterms="http://purl.org/dc/terms/">
          <skos:ConceptScheme rdf:about="http://example.com/scheme">
            <skos:prefLabel>Example Scheme</skos:prefLabel>
            <dcterms:created>2023-01-01</dcterms:created>
          </skos:ConceptScheme>
        </rdf:RDF>
      `
      const result = addCreatedDateToConceptScheme(inputRdf)
      expect(result).toBe(inputRdf)
    })
  })

  describe('When given invalid RDF/XML', () => {
    test('should return the input unchanged', () => {
      const invalidRdf = '<invalid>XML</invalid>'
      const result = addCreatedDateToConceptScheme(invalidRdf)
      expect(result).toBe(invalidRdf)
    })
  })

  describe('When given RDF/XML without a skos:ConceptScheme', () => {
    test('should return the input unchanged', () => {
      const inputRdf = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:skos="http://www.w3.org/2004/02/skos/core#"
                 xmlns:dcterms="http://purl.org/dc/terms/">
          <skos:Concept rdf:about="http://example.com/concept">
            <skos:prefLabel>Example Concept</skos:prefLabel>
          </skos:Concept>
        </rdf:RDF>
      `
      const result = addCreatedDateToConceptScheme(inputRdf)
      expect(result).toBe(inputRdf)
    })
  })

  describe('When an error occurs during processing', () => {
    test('should log the error and return the input unchanged', () => {
      // Mock console.error
      const originalConsoleError = console.error
      console.error = vi.fn()

      // Create a spy on XMLParser to simulate an error
      vi.spyOn(XMLParser.prototype, 'parse').mockImplementation(() => {
        throw new Error('Mocked parsing error')
      })

      const inputRdf = '<rdf:RDF></rdf:RDF>'
      const result = addCreatedDateToConceptScheme(inputRdf)

      // Check if console.error was called with the expected message
      expect(console.error).toHaveBeenCalledWith('Error processing RDF/XML:', expect.any(Error))

      // Check if the input is returned unchanged
      expect(result).toBe(inputRdf)

      // Restore the original console.error and XMLParser
      console.error = originalConsoleError
      vi.restoreAllMocks()
    })
  })
})
