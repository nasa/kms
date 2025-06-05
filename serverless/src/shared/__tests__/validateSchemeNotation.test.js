import {
  describe,
  expect,
  test
} from 'vitest'

import { validateSchemeNotation } from '../validateSchemeNotation'

describe('validateSchemeNotation', () => {
  test('When given valid RDF XML, should return true', () => {
    const validRdf = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme rdf:about="https://example.com/scheme/a12">
          <skos:notation>a12</skos:notation>
        </skos:ConceptScheme>
      </rdf:RDF>
    `
    expect(validateSchemeNotation(validRdf)).toBe(true)
  })

  test('When skos:ConceptScheme is missing, should throw an error', () => {
    const invalidRdf = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:skos="http://www.w3.org/2004/02/skos/core#">
      </rdf:RDF>
    `
    expect(() => validateSchemeNotation(invalidRdf)).toThrow('skos:ConceptScheme element not found')
  })

  test('When rdf:about is missing, should throw an error', () => {
    const invalidRdf = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme>
          <skos:notation>a12</skos:notation>
        </skos:ConceptScheme>
      </rdf:RDF>
    `
    expect(() => validateSchemeNotation(invalidRdf)).toThrow('rdf:about attribute not found on skos:ConceptScheme')
  })

  test('When skos:notation is missing, should throw an error', () => {
    const invalidRdf = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme rdf:about="https://example.com/scheme/a12">
        </skos:ConceptScheme>
      </rdf:RDF>
    `
    expect(() => validateSchemeNotation(invalidRdf)).toThrow('skos:notation element not found')
  })

  test('When rdf:about does not match skos:notation, should throw an error', () => {
    const invalidRdf = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:skos="http://www.w3.org/2004/02/skos/core#">
        <skos:ConceptScheme rdf:about="https://example.com/scheme/a12">
          <skos:notation>b34</skos:notation>
        </skos:ConceptScheme>
      </rdf:RDF>
    `
    expect(() => validateSchemeNotation(invalidRdf)).toThrow('Mismatch: rdf:about (a12) does not match skos:notation (b34)')
  })
})
