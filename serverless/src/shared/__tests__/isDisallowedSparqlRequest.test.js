import {
  describe,
  expect,
  test
} from 'vitest'

import { isDisallowedSparqlRequest } from '../isDisallowedSparqlRequest'

describe('isDisallowedSparqlRequest', () => {
  test.each([
    'SELECT * WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } }',
    'SELECT * WHERE { service silent <https://example.com/sparql> { ?s ?p ?o } }',
    'SELECT * WHERE { SERVICE ?endpoint { ?s ?p ?o } }',
    'PREFIX remote: <https://example.com/> SELECT * WHERE { SERVICE remote:sparql { ?s ?p ?o } }',
    'SELECT * WHERE { SERVICE # remote endpoint\n <https://example.com/sparql> { ?s ?p ?o } }',
    'DELETE { ?s ?p ?o } WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } }',
    'SELECT * WHERE { { SELECT * WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } } } }',
    String.raw`SELECT * WHERE { \u0053ERVICE <https://example.com/sparql> { ?s ?p ?o } }`,
    'LOAD <https://example.com/data.ttl>',
    'LOAD SILENT <https://example.com/data.ttl> INTO GRAPH <https://example.com/graph>',
    String.raw`\u004cOAD <https://example.com/data.ttl>`,
    'SELECT * FROM <https://example.com/data> WHERE { ?s ?p ?o }',
    String.raw`SELECT * \u0046ROM <https://example.com/data> WHERE { ?s ?p ?o }`,
    'SELECT * FROM NAMED <https://example.com/data> WHERE { GRAPH ?g { ?s ?p ?o } }',
    'SELECT * FROM NAMED <https://gcmd.earthdata.nasa.gov/kms/version/published> WHERE { GRAPH ?g { ?s ?p ?o } }',
    'DELETE { ?s ?p ?o } USING <https://example.com/data> WHERE { ?s ?p ?o }',
    String.raw`DELETE { ?s ?p ?o } \u0055SING <https://example.com/data> WHERE { ?s ?p ?o }`,
    'DELETE { GRAPH ?g { ?s ?p ?o } } USING NAMED <https://gcmd.earthdata.nasa.gov/kms/version/published> WHERE { GRAPH ?g { ?s ?p ?o } }'
  ])('identifies a disallowed SPARQL request in %s', (sparql) => {
    expect(isDisallowedSparqlRequest(sparql)).toBe(true)
  })

  test.each([
    'SELECT * WHERE { BIND("Customer SERVICE <https://example.com>" AS ?label) }',
    "SELECT * WHERE { BIND('LOAD <https://example.com/data>' AS ?label) }",
    'SELECT * WHERE { BIND("FROM <https://example.com/data>" AS ?label) }',
    'SELECT * WHERE { <https://example.com/SERVICE> ?p ?o }',
    'SELECT * WHERE { ?SERVICE ?p ?o }',
    'PREFIX SERVICE: <https://example.com/> SELECT * WHERE { SERVICE:item ?p ?o }',
    'SELECT * WHERE { ?s ?p ?o } # SERVICE <https://example.com>',
    'SELECT * WHERE { ?s ?p ?o } # LOAD <https://example.com/data>',
    'SELECT * WHERE { BIND("USING <https://example.com/data>" AS ?label) }',
    'SELECT * WHERE { FILTER(?count < 10) ?s ?p ?o }',
    'SELECT * FROM <https://gcmd.earthdata.nasa.gov/kms/version/published> WHERE { ?s ?p ?o }',
    'DELETE { ?s ?p ?o } USING <https://gcmd.earthdata.nasa.gov/kms/version/published> WHERE { ?s ?p ?o }'
  ])('allows a valid SPARQL request without remote-data operations in %s', (sparql) => {
    expect(isDisallowedSparqlRequest(sparql)).toBe(false)
  })

  test.each([
    String.raw`\UFFFFFFFF LOAD <https://example.com/data.ttl>`,
    'LOAD <unfinished',
    'SELECT * FROM <unfinished WHERE { ?s ?p ?o }',
    'DELETE { ?s ?p ?o } USING <unfinished WHERE { ?s ?p ?o }',
    'SELECT * WHERE { SERVICE <unfinished'
  ])('rejects malformed SPARQL containing a remote-operation keyword (%s)', (sparql) => {
    expect(isDisallowedSparqlRequest(sparql)).toBe(true)
  })

  test.each([
    'SELECT * WHERE { <unfinished',
    undefined,
    null,
    {}
  ])('ignores input without a remote-operation keyword (%s)', (sparql) => {
    expect(isDisallowedSparqlRequest(sparql)).toBe(false)
  })
})
