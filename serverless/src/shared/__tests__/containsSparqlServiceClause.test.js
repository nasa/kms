import {
  describe,
  expect,
  test
} from 'vitest'

import { containsSparqlServiceClause } from '../containsSparqlServiceClause'

describe('containsSparqlServiceClause', () => {
  test.each([
    'SELECT * WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } }',
    'SELECT * WHERE { service silent <https://example.com/sparql> { ?s ?p ?o } }',
    'SELECT * WHERE { SERVICE ?endpoint { ?s ?p ?o } }',
    'PREFIX remote: <https://example.com/> SELECT * WHERE { SERVICE remote:sparql { ?s ?p ?o } }',
    'SELECT * WHERE { SERVICE # remote endpoint\n <https://example.com/sparql> { ?s ?p ?o } }',
    'DELETE { ?s ?p ?o } WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } }',
    'SELECT * WHERE { { SELECT * WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } } } }'
  ])('identifies a federated SERVICE clause in %s', (sparql) => {
    expect(containsSparqlServiceClause(sparql)).toBe(true)
  })

  test.each([
    'SELECT * WHERE { BIND("Customer SERVICE <https://example.com>" AS ?label) }',
    "SELECT * WHERE { BIND('Customer SERVICE' AS ?label) }",
    'SELECT * WHERE { BIND("""Customer SERVICE""" AS ?label) }',
    "SELECT * WHERE { BIND('''Customer SERVICE''' AS ?label) }",
    'SELECT * WHERE { <https://example.com/SERVICE> ?p ?o }',
    'SELECT * WHERE { ?SERVICE ?p ?o }',
    'PREFIX SERVICE: <https://example.com/> SELECT * WHERE { SERVICE:item ?p ?o }',
    'SELECT * WHERE { ?s ?p ?o } # SERVICE <https://example.com>',
    'SELECT * WHERE { FILTER(?count < 10) ?s ?p ?o }',
    'SELECT * WHERE { BIND("Customer \\"SERVICE\\"" AS ?label) }',
    'SELECT * WHERE { <unfinished'
  ])('ignores SERVICE text that is not a clause in %s', (sparql) => {
    expect(containsSparqlServiceClause(sparql)).toBe(false)
  })

  test.each([undefined, null, {}])('ignores non-string input (%s)', (sparql) => {
    expect(containsSparqlServiceClause(sparql)).toBe(false)
  })
})
