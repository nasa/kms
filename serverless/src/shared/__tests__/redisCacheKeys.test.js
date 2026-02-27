import {
  describe,
  expect,
  test
} from 'vitest'

import {
  CONCEPT_CACHE_KEY_PREFIX,
  CONCEPTS_CACHE_KEY_PREFIX,
  CONCEPTS_CACHE_VERSION_KEY,
  createConceptResponseCacheKey,
  createConceptsResponseCacheKey,
  createTreeResponseCacheKey,
  TREE_CACHE_KEY_PREFIX
} from '@/shared/redisCacheKeys'

describe('when creating response cache keys', () => {
  describe('when creating concept keys', () => {
    test('uses defaults for missing values', () => {
      const key = createConceptResponseCacheKey({})

      expect(key).toBe(`${CONCEPT_CACHE_KEY_PREFIX}:published:::rdf:::::`)
    })

    test('normalizes paths, format, and url-encodes values', () => {
      const key = createConceptResponseCacheKey({
        version: 'published',
        path: '/CONCEPT/FULL_PATH/{fullPath+}',
        endpointPath: '/CONCEPT/FULL_PATH/SPACE WEATHER',
        format: 'JSON',
        conceptId: 'A B',
        shortName: 'Short/Name',
        altLabel: 'Alt Label',
        fullPath: 'SPACE|EARTH SCIENCE',
        scheme: 'Science Keywords'
      })

      expect(key).toBe(
        `${CONCEPT_CACHE_KEY_PREFIX}:published:/concept/full_path/{fullpath+}:/concept/full_path/space weather:json:A%20B:Short%2FName:Alt%20Label:SPACE%7CEARTH%20SCIENCE:Science%20Keywords`
      )
    })
  })

  describe('when creating concepts keys', () => {
    test('uses default version and format for missing values', () => {
      const key = createConceptsResponseCacheKey({
        path: '/CONCEPTS',
        endpointPath: '/CONCEPTS',
        pageNum: 1,
        pageSize: 2000
      })

      expect(key).toBe(`${CONCEPTS_CACHE_KEY_PREFIX}:published:/concepts:/concepts:::1:2000:rdf`)
    })

    test('normalizes scheme alias and lower-cases pattern/format/path', () => {
      const key = createConceptsResponseCacheKey({
        version: 'draft',
        path: '/CONCEPTS/CONCEPT_SCHEME/{conceptScheme}',
        endpointPath: '/CONCEPTS/CONCEPT_SCHEME/GranuleDataFormat',
        conceptScheme: 'granuledataformat',
        pattern: 'EaRTh ScIeNcE',
        pageNum: 2,
        pageSize: 50,
        format: 'JSON'
      })

      expect(key).toBe(
        `${CONCEPTS_CACHE_KEY_PREFIX}:draft:/concepts/concept_scheme/{conceptscheme}:/concepts/concept_scheme/granuledataformat:dataformat:earth science:2:50:json`
      )
    })
  })

  describe('when creating tree keys', () => {
    test('uses defaults for missing version, scheme, and filter', () => {
      const key = createTreeResponseCacheKey({})

      expect(key).toBe(`${TREE_CACHE_KEY_PREFIX}:published::`)
    })

    test('lower-cases and url-encodes scheme and filter', () => {
      const key = createTreeResponseCacheKey({
        version: 'published',
        conceptScheme: 'Earth Science',
        filter: 'Water Vapor'
      })

      expect(key).toBe(`${TREE_CACHE_KEY_PREFIX}:published:earth%20science:water%20vapor`)
    })
  })

  describe('when reading constants', () => {
    test('exports the published version marker key', () => {
      expect(CONCEPTS_CACHE_VERSION_KEY).toBe(`${CONCEPTS_CACHE_KEY_PREFIX}:published:version`)
    })
  })
})
