/**
 * Primes /tree/concept_scheme/all and /tree/concept_scheme/{scheme}.
 *
 * @param {Object} params - Prime parameters.
 * @param {Object[]} params.schemes - Concept schemes.
 * @param {Function} params.getKeywordsTree - getKeywordsTree handler function.
 * @param {Function} params.createTreeCacheKeyFromEvent - Tree cache key builder.
 * @param {string} params.primeVersion - Version being primed.
 * @returns {Promise<{treeSettled: PromiseSettledResult[]}>}
 */
export const primeKeywordTrees = async ({
  schemes,
  getKeywordsTree,
  createTreeCacheKeyFromEvent,
  primeVersion
}) => {
  const allEntry = {
    label: '/tree/concept_scheme/all',
    event: {
      resource: '/tree/concept_scheme/{conceptScheme}',
      path: '/tree/concept_scheme/all',
      pathParameters: {
        conceptScheme: 'all'
      },
      queryStringParameters: {
        version: primeVersion
      }
    },
    cacheKey: null
  }
  allEntry.cacheKey = createTreeCacheKeyFromEvent(allEntry.event)

  const schemeEntries = schemes.map((scheme) => {
    const { notation } = scheme
    const entry = {
      label: `/tree/concept_scheme/${notation}`,
      event: {
        resource: '/tree/concept_scheme/{conceptScheme}',
        path: `/tree/concept_scheme/${notation}`,
        pathParameters: {
          conceptScheme: notation
        },
        queryStringParameters: {
          version: primeVersion
        }
      },
      cacheKey: null
    }
    entry.cacheKey = createTreeCacheKeyFromEvent(entry.event)

    return entry
  })

  const entries = [allEntry, ...schemeEntries]
  const treeSettled = await entries.reduce(async (accPromise, entry) => {
    const acc = await accPromise
    try {
      console.log(`[cache-prime] iter tree route=${entry.label}`)
      const response = await getKeywordsTree(entry.event, {})
      acc.push({
        status: 'fulfilled',
        value: {
          entry,
          response
        }
      })
    } catch (error) {
      acc.push({
        status: 'rejected',
        reason: error
      })
    }

    return acc
  }, Promise.resolve([]))

  return {
    treeSettled
  }
}
