import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  createConceptToConceptSchemeShortNameMap
} from '../createConceptToConceptSchemeShortNameMap'
import { sparqlRequest } from '../sparqlRequest'
import { toLegacyXML } from '../toLegacyXML'

vi.mock('../sparqlRequest', () => ({ sparqlRequest: vi.fn() }))

const conceptBase = 'https://gcmd.earthdata.nasa.gov/kms/concept/'
const details = [{
  notation: 'sciencekeywords',
  prefLabel: 'Science Keywords'
}]
const entries = [['related-1', 'projects'], ['related-2', 'platforms']]
const prefLabels = new Map([['related-1', 'Project & program'], ['related-2', 'Platform']])

const convert = (relations, schemes) => toLegacyXML({
  '@rdf:about': 'source',
  'skos:prefLabel': { _text: 'Source' },
  'skos:related': relations
}, details, [], schemes, prefLabels, 'sciencekeywords', '26.2', '2026-09-24')

describe('legacy XML related concept schemes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: {
          bindings: entries.map(([uuid, scheme]) => ({
            concept: { value: `${conceptBase}${uuid}` },
            schemeShortName: { value: scheme }
          }))
        }
      })
    })
  })

  test.each([
    ['bare identifier', 'related-1'],
    ['full concept IRI', `${conceptBase}related-1`]
  ])('uses the actual scheme map for a %s', async (_, resource) => {
    const schemes = await createConceptToConceptSchemeShortNameMap('published')
    const relation = { '@rdf:resource': resource }
    const result = convert(relation, schemes)

    expect(result.concept.related.weightedRelation[0]).toMatchObject({
      '@conceptScheme': 'projects',
      '@uuid': resource,
      '@generatedBy': 'server'
    })

    expect(relation).toEqual({ '@rdf:resource': resource })
    expect([...schemes.entries()]).toEqual(entries)
  })

  test('preserves each scheme in actual serialized XML', async () => {
    const schemes = await createConceptToConceptSchemeShortNameMap('draft')
    const relations = entries.map(([uuid]) => ({ '@rdf:resource': uuid }))
    const result = convert(relations, schemes)
    const options = {
      ignoreAttributes: false,
      attributeNamePrefix: '@'
    }
    const xml = new XMLBuilder(options).build(result)
    const parsed = new XMLParser(options).parse(xml)

    expect(parsed.concept.related.weightedRelation).toEqual([
      {
        '@generatedBy': 'server',
        '@conceptScheme': 'projects',
        '@prefLabel': 'Project & program',
        '@uuid': 'related-1'
      },
      {
        '@generatedBy': 'server',
        '@conceptScheme': 'platforms',
        '@prefLabel': 'Platform',
        '@uuid': 'related-2'
      }
    ])

    expect(relations).toEqual(entries.map(([uuid]) => ({ '@rdf:resource': uuid })))
  })

  test('leaves unknown schemes absent rather than using the source scheme', () => {
    const result = convert({ '@rdf:resource': 'unknown' }, new Map(entries))
    const relation = result.concept.related.weightedRelation[0]

    expect(relation['@conceptScheme']).toBeUndefined()
    expect(relation['@uuid']).toBe('unknown')
  })

  test('preserves the empty-related response', () => {
    expect(convert(undefined, new Map(entries)).concept.related).toEqual({})
    expect(convert([], new Map(entries)).concept.related).toEqual({})
  })
})
