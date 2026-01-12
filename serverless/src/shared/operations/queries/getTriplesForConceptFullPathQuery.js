import prefixes from '@/shared/constants/prefixes'

/**
 * Generates a SPARQL query to retrieve triples for a concept based on its full path in a hierarchical structure.
 *
 * This function constructs a SPARQL query that:
 * 1. Finds a concept within a specific scheme based on its full hierarchical path.
 * 2. Retrieves all direct properties of the found concept.
 * 3. Retrieves all properties of blank nodes connected to the concept.
 *
 * @function getTriplesForConceptFullPathQuery
 * @param {Object} options - The options for constructing the query.
 * @param {string[]} options.levels - An array representing the hierarchical path to the concept, from root to target.
 * @param {string} options.scheme - The scheme long name (prefLabel) to filter the concept search.
 * @param {string} options.targetConcept - The label of the target concept (last element in the hierarchy).
 * @returns {string} A SPARQL query string.
 *
 * @example
 * const query = getTriplesForConceptFullPathQuery({
 *   levels: ['Earth Science', 'Atmosphere', 'Air Quality', 'Emissions'],
 *   scheme: 'sciencekeywords',
 *   targetConcept: 'Emissions'
 * });
 *
 * // The resulting query will:
 * // 1. Find the concept 'Emissions' within the 'sciencekeywords' scheme
 * // 2. Ensure it's a descendant of 'Earth Science' > 'Atmosphere' > 'Air Quality'
 * // 3. Retrieve all properties of this concept and its associated blank nodes
 *
 * @description
 * The query uses a nested structure to:
 * - First, identify the correct concept based on the full path.
 * - Then, retrieve all relevant triples for that concept.
 * It handles concepts at any depth in the hierarchy and ensures the correct
 * concept is selected even if there are concepts with the same label in different branches.
 */
export const getTriplesForConceptFullPathQuery = ({ levels, scheme, targetConcept }) => `
    ${prefixes}
    SELECT DISTINCT ?s ?p ?o
    WHERE {
      {
        SELECT DISTINCT ?concept
        WHERE {
          # Find the root concept in the specified scheme
          ?root skos:prefLabel ?rootLabel .
          FILTER(LCASE(STR(?rootLabel)) = LCASE("${levels[0]}"))
          ?root skos:inScheme ?scheme .
          ?scheme skos:prefLabel ?schemePrefLabel .
          FILTER(LCASE(STR(?schemePrefLabel)) = LCASE("${scheme}"))
          
          # Find the target concept
          ?concept skos:prefLabel ?conceptLabel .
          FILTER(LCASE(STR(?conceptLabel)) = LCASE("${targetConcept}"))
          
          # Build the sequential chain from root through intermediates to concept
          ${levels.slice(1, -1).map((level, index) => {
    const prevNode = index === 0 ? '?root' : `?mid${index - 1}`

    return `
            ?mid${index} skos:prefLabel ?midLabel${index} .
            FILTER(LCASE(STR(?midLabel${index})) = LCASE("${level}"))
            ?mid${index} skos:broader+ ${prevNode} .`
  }).join('\n')}
          
          # Connect concept to the last node in the chain
          ${levels.length > 2
    ? `?concept skos:broader+ ?mid${levels.length - 3} .`
    : '?concept skos:broader+ ?root .'
}
        }
        LIMIT 1
      }
      
      {
        ?concept ?p ?o .
        BIND(?concept AS ?s)
      }
      UNION
      {
        ?concept ?p1 ?bnode .
        ?bnode ?p ?o .
        BIND(?bnode AS ?s)
        FILTER(isBlank(?bnode))
      }
    }
  `
