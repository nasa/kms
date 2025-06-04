import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Adds SKOS change notes to concepts based on added and removed relations.
 *
 * @async
 * @function addChangeNotes
 * @param {Array<Object>} addedRelations - Array of relation objects that were added
 * @param {Array<Object>} removedRelations - Array of relation objects that were removed
 * @param {string} version - The version of the concept (e.g., 'draft', 'published')
 * @param {string} transactionUrl - The URL of the current transaction
 * @throws {Error} If there's an issue adding the change notes to the triplestore
 *
 * @example
 * const addedRelations = [
 *   {
 *     from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
 *     relation: 'broader',
 *     to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
 *     fromPrefLabel: 'Concept A',
 *     toPrefLabel: 'Concept B'
 *   }
 * ];
 * const removedRelations = [
 *   {
 *     from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
 *     relation: 'related',
 *     to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
 *     fromPrefLabel: 'Concept A',
 *     toPrefLabel: 'Concept C'
 *   }
 * ];
 * await addChangeNotes(addedRelations, removedRelations, 'draft', 'http://example.com/transaction/1');
 *
 * @description
 * This function generates SKOS change notes for each added and removed relation, and adds them to the respective concepts in the triplestore.
 * The change notes include the date, user ID (set to 'system'), and a description of the change.
 * The function performs the following steps:
 * 1. Generates change note strings for added and removed relations
 * 2. Constructs a SPARQL query to insert these change notes
 * 3. Executes the SPARQL query within the specified transaction
 *
 * The change note format is:
 * "Date=YYYY-MM-DD User Id=system System Note=Added/Removed [relation] relation from [fromPrefLabel] [fromUuid] to [toPrefLabel] [toUuid]"
 *
 * Note: This function assumes that the relations are represented by full URIs and extracts the UUID from these URIs for the change note.
 * It also assumes that each relation object includes 'fromPrefLabel' and 'toPrefLabel' properties containing the preferred labels of the concepts.
 */

export const addChangeNotes = async (addedRelations, removedRelations, version, transactionUrl) => {
  function extractUuid(uri) {
    return uri.split('/').pop()
  }

  const currentDate = new Date().toISOString().split('T')[0]

  const changeNotes = [
    ...addedRelations.map((relation) => ({
      from: relation.from,
      note: `Date=${currentDate} User Id=system System Note=Added ${relation.relation} relation from ${relation.fromPrefLabel} [${extractUuid(relation.from)}] to ${relation.toPrefLabel} [${extractUuid(relation.to)}]`
    })),
    ...removedRelations.map((relation) => ({
      from: relation.from,
      note: `Date=${currentDate} User Id=system System Note=Removed ${relation.relation} relation from ${relation.fromPrefLabel} [${extractUuid(relation.from)}] to ${relation.toPrefLabel} [${extractUuid(relation.to)}]`
    }))
  ]

  const changeNotesQueries = changeNotes.map((changeNote) => `
    <${changeNote.from}> skos:changeNote "${changeNote.note}" .
  `).join('\n')

  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    WITH <https://gcmd.earthdata.nasa.gov/kms/version/${version}>
    INSERT {
      ${changeNotesQueries}
    } 
    WHERE { }
  `

  const response = await sparqlRequest({
    method: 'POST',
    contentType: 'application/sparql-update',
    accept: 'application/json',
    body: query,
    version,
    transaction: {
      transactionUrl,
      action: 'UPDATE'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to add change notes: ${response.status}`)
  }
}
