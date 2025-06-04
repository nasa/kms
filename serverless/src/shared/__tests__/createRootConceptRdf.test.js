import { XMLParser } from 'fast-xml-parser'
import {
  describe,
  expect,
  test
} from 'vitest'

import { createRootConceptRdf } from '../createRootConceptRdf'

describe('createRootConceptRdf', () => {
  describe('When called with a schemeId and schemePrefLabel', () => {
    const schemeId = 'testSchemeId'
    const schemePrefLabel = 'Test Scheme Label'
    const result = createRootConceptRdf(schemeId, schemePrefLabel)

    test('should return a non-empty string', () => {
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    test('should return valid XML', () => {
      const parser = new XMLParser()
      expect(() => parser.parse(result)).not.toThrow()
    })

    test('should include correct RDF and SKOS namespaces', () => {
      expect(result).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
      expect(result).toContain('xmlns:skos="http://www.w3.org/2004/02/skos/core#"')
    })

    test('should include a skos:Concept element', () => {
      expect(result).toContain('<skos:Concept')
    })

    test('should include the provided schemePrefLabel', () => {
      expect(result).toContain(schemePrefLabel)
    })

    test('should include a reference to the provided schemeId', () => {
      expect(result).toContain(`concept_scheme/${schemeId}`)
    })

    test('should generate a valid UUID for rdf:about', () => {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/
      expect(result).toMatch(uuidRegex)
    })
  })
})
