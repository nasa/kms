import { format } from 'date-fns'

import { buildKeywordsTree } from '@/shared/buildKeywordsTree'
import { filterKeywordTree } from '@/shared/filterKeywordTree'
import { filterScienceKeywordsTree } from '@/shared/filterScienceKeywordsTree'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getNarrowersMap } from '@/shared/getNarrowersMap'
import { getRootConceptForScheme } from '@/shared/getRootConceptForScheme'
import { getRootConceptsForAllSchemes } from '@/shared/getRootConceptsForAllSchemes'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sortKeywordNodes } from '@/shared/sortKeywordNodes'
import { keywordSchemeSequence, sortKeywordSchemes } from '@/shared/sortKeywordSchemes'
import { toTitleCase } from '@/shared/toTitleCase'

/**
 * Retrieves and processes a keywords tree based on the provided concept scheme and version.
 *
 * @async
 * @function getKeywordsTree
 * @param {Object} event - The event object containing query and path parameters.
 * @param {Object} event.queryStringParameters - Query string parameters.
 * @param {string} [event.queryStringParameters.filter] - Optional filter string to apply to the tree.
 * @param {string} [event.queryStringParameters.version='published'] - The version of the keywords to retrieve (default is 'published').
 * @param {Object} event.pathParameters - Path parameters.
 * @param {string} event.pathParameters.conceptScheme - The concept scheme to retrieve keywords for.
 * @throws {Object} Returns a 400 error if conceptScheme is missing from pathParameters.
 * @returns {Promise<Object>} A promise that resolves to an object containing the status code, body, and headers.
 *
 * @example
 * // Request for all schemes with a specific version
 * const event = {
 *   pathParameters: { conceptScheme: 'all' },
 *   queryStringParameters: { filter: 'atmosphere', version: 'draft' }
 * };
 * const result = await getKeywordsTree(event);
 * // Result will contain a tree of all keyword schemes from the draft version, filtered by 'atmosphere'
 *
 * @example
 * // Request for Earth Science scheme with default (published) version
 * const event = {
 *   pathParameters: { conceptScheme: 'earth science' },
 *   queryStringParameters: {}
 * };
 * const result = await getKeywordsTree(event);
 * // Result will contain the published Earth Science keywords tree
 *
 * @example
 * // Request for a specific scheme with a specific version
 * const event = {
 *   pathParameters: { conceptScheme: 'instruments' },
 *   queryStringParameters: { version: '9.1.5' }
 * };
 * const result = await getKeywordsTree(event);
 * // Result will contain the Instruments keywords tree from version 9.1.5
 *
 * @throws Will throw an error if there's a problem retrieving or processing the keywords.
 */
export const getKeywordsTree = async (event) => {
  // Extract configuration and parameters
  const { defaultResponseHeaders } = getApplicationConfig()

  // Check if pathParameters exists
  if (!event.pathParameters) {
    console.error('Missing pathParameters')

    return {
      headers: defaultResponseHeaders,
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required parameters'
      })
    }
  }

  const queryStringParameters = event.queryStringParameters || {}
  const { filter } = queryStringParameters
  const encodedConceptScheme = event.pathParameters.conceptScheme
  const conceptScheme = decodeURIComponent(encodedConceptScheme)
  const version = queryStringParameters?.version || 'published'

  if (!event.pathParameters || !event.pathParameters.conceptScheme) {
    console.error('Missing conceptScheme parameter')

    return {
      headers: defaultResponseHeaders,
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing conceptScheme parameter'
      })
    }
  }

  try {
    let keywordTree = []
    const lowerCaseConceptScheme = conceptScheme.toLowerCase()
    const isAllSchemes = lowerCaseConceptScheme === 'all'
    let derivedScheme = conceptScheme

    // Handle special cases for Earth Science schemes
    if (lowerCaseConceptScheme === 'earth science' || lowerCaseConceptScheme === 'earth science services') {
      derivedScheme = 'sciencekeywords'
    }

    // Retrieve narrowers map
    const narrowersMap = await getNarrowersMap(isAllSchemes ? undefined : derivedScheme, version)

    // Retrieve root concepts
    let roots
    if (isAllSchemes) {
      roots = await getRootConceptsForAllSchemes(version)
      roots = roots.filter((root) => root?.prefLabel?.value.toLowerCase() !== 'trash can')
    } else {
      const root = await getRootConceptForScheme(derivedScheme, version)
      roots = [root]
    }

    // Use Promise.all to wait for all async operations to complete
    keywordTree = await Promise.all(roots.map(async (root) => {
      const node = {
        prefLabel: root?.prefLabel?.value,
        narrowerPrefLabel: root?.prefLabel?.value,
        uri: root?.subject?.value
      }

      let tree = await buildKeywordsTree(node, narrowersMap)

      // Apply special filtering for Earth Science schemes
      if (!isAllSchemes && (conceptScheme.toLowerCase() === 'earth science' || conceptScheme.toLowerCase() === 'earth science services')) {
        tree = filterScienceKeywordsTree(tree, conceptScheme)
      }

      return tree
    }))

    // Process and sort the tree for all schemes
    if (isAllSchemes) {
      // Process the tree to remove "Science Keywords" node and promote its children
      keywordTree = keywordTree.flatMap((tree) => {
        if (tree.title === 'Science Keywords') {
          // Apply toTitleCase to direct descendants of 'Science Keywords'
          return tree.children.map((child) => ({
            ...child,
            title: toTitleCase(child.title)
          }))
        }

        return tree
      })

      // Sort and group keywords
      let sortedTree = []
      let otherKeywords = []

      keywordTree.forEach((node) => {
        if (keywordSchemeSequence.includes(node.title)) {
          sortedTree.push(node)
        } else {
          otherKeywords.push(node)
        }
      })

      // Apply sorting to trees
      sortedTree.sort(sortKeywordSchemes)
      sortedTree = sortKeywordNodes(sortedTree)
      otherKeywords.sort((a, b) => a.title.localeCompare(b.title))
      otherKeywords = sortKeywordNodes(otherKeywords)

      if (otherKeywords.length > 0) {
        sortedTree.push({
          title: 'Other Keywords',
          children: otherKeywords
        })
      }

      keywordTree = sortedTree
    } else {
      keywordTree = sortKeywordNodes(keywordTree)
    }

    // Apply filter if provided
    if (filter) {
      if (isAllSchemes) {
        keywordTree = keywordTree
          .map((tree) => filterKeywordTree(tree, filter))
          .filter((tree) => tree !== null)
      } else {
        keywordTree = filterKeywordTree(keywordTree[0], filter)
      }
    }

    // Retrieve concept scheme details and process them
    const conceptSchemes = await getConceptSchemeDetails({ version })
    const versionInfo = await getVersionMetadata(version)

    let idCounter = 0 // Initialize a counter for generating unique IDs

    const processedSchemes = conceptSchemes.flatMap((scheme) => {
      if (scheme.notation === 'sciencekeywords') {
        // For 'sciencekeywords', create two special entries
        return [
          {
            id: idCounter + 1,
            scheme: 'Earth Science',
            longName: 'Earth Science'
          },
          {
            id: idCounter + 2,
            scheme: 'Earth Science Services',
            longName: 'Earth Science Services'
          }
        ].map((entry) => {
          idCounter += 1

          return entry
        })
      }

      // For all other schemes, create a single entry as before
      idCounter += 1

      return [{
        id: idCounter,
        scheme: scheme.notation,
        longName: scheme.prefLabel
      }]
    })

    // Sort processedSchemes using the existing sortKeywordSchemes function
    const sortedProcessedSchemes = processedSchemes.sort((a, b) => sortKeywordSchemes(
      { title: a.longName },
      { title: b.longName }
    ))

    // Wrap the tree in the expected format
    const treeData = {
      versions: [
        {
          id: 999,
          version: versionInfo.versionName,
          type: versionInfo.versionType.toUpperCase(),
          schemes: sortedProcessedSchemes
        }
      ],
      tree: {
        scheme: `${conceptScheme}`,
        version: versionInfo.versionName,
        timestamp: format(Date.now(), 'yyyy-MM-dd HH:mm:ss'),
        treeData: [
          {
            key: 'keywords-uuid',
            title: 'Keywords',
            children: keywordTree
          }
        ]
      }
    }

    // Return successful response with tree data
    return {
      statusCode: 200,
      body: JSON.stringify(treeData, null, 2),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    // Log and return error response
    console.error(`Error retrieving concept, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getKeywordsTree
