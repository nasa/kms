import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'
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
 * @throws {Error} If there's an issue adding the change notes to the triplestore, or if
 *   the version or any relation's from/to IRI fails validation
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
 * 1. Validates `version` against a strict allowlist, since it is interpolated into an IRI (<.../version/${version}>)
 * 2. Validates and normalizes each relation's `from`/`to` IRIs via sanitizeConceptIRI (also IRI context), rejecting
 *    the whole call if any IRI is not a clean, well-formed concept IRI
 * 3. Escapes free-text fields (relation type, from/to pref labels) via escapeSparqlString, since these are
 *    interpolated into a quoted SPARQL string literal, a different context from the IRIs above
 * 4. Constructs a SPARQL query to insert the resulting change notes
 * 5. Executes the SPARQL query within the specified transaction
 *
 * The change note format is:
 * "Date=YYYY-MM-DD User Id=system System Note=Added/Removed [relation] relation from [fromPrefLabel] [fromUuid] to [toPrefLabel] [toUuid]"
 *
 * Note: This function assumes that the relations are represented by full URIs and extracts the UUID from these URIs for the change note.
 * It also assumes that each relation object includes 'fromPrefLabel' and 'toPrefLabel' properties containing the preferred labels of the concepts.
 */

// Version is interpolated directly into an IRI (<.../version/${version}>),
// not a string literal, so it needs an IRI-safe allowlist, not
// escapeSparqlString (which only protects quoted string literals).
const versionRegex = /^[a-zA-Z0-9_-]+$/

export const addChangeNotes = async (addedRelations, removedRelations, version, transactionUrl) => {
  if (!versionRegex.test(version)) {
    throw new Error(`Invalid version: ${version}`)
  }

  function extractUuid(uri) {
    return uri.split('/').pop()
  }

  // Validates + normalizes a relation's `from`/`to` IRIs before they're used
  // in either an IRIREF (<...>) or as the source of an extracted UUID.
  // Fails closed: if sanitizeConceptIRI returns null or if the output
  // differs from the raw input, the input wasn't a legitimate concept IRI,
  // so we throw rather than silently writing a mangled/meaningless UUID.
  function sanitizeRelationIRIs(relation) {
    const safeFrom = sanitizeConceptIRI(relation.from)
    const safeTo = sanitizeConceptIRI(relation.to)

    if (safeFrom === null || safeTo === null
      || safeFrom !== relation.from || safeTo !== relation.to) {
      throw new Error(`Invalid relation IRI: from=${relation.from} to=${relation.to}`)
    }

    return {
      ...relation,
      from: safeFrom,
      to: safeTo
    }
  }

  const currentDate = new Date().toISOString().split('T')[0]

  const buildNote = (relation, verb) => {
    const safeRelation = sanitizeRelationIRIs(relation)

    if (safeRelation === null) {
      throw new Error('Invalid relation provided')
    }

    // Relation.relation and the pref labels are free-text values that land
    // inside a double-quoted SPARQL string literal below — this is exactly
    // the context escapeSparqlString protects.
    const relationType = escapeSparqlString(safeRelation.relation)
    const fromLabel = escapeSparqlString(safeRelation.fromPrefLabel)
    const toLabel = escapeSparqlString(safeRelation.toPrefLabel)

    // From/to are already sanitized IRIs at this point, so the extracted
    // UUID segment is constrained by sanitizeConceptIRI's own allowlist.
    const fromUuid = extractUuid(safeRelation.from)
    const toUuid = extractUuid(safeRelation.to)

    return {
      from: safeRelation.from,
      note: `Date=${currentDate} User Id=system System Note=${verb} ${relationType} relation from ${fromLabel} [${fromUuid}] to ${toLabel} [${toUuid}]`
    }
  }

  const changeNotes = [
    ...addedRelations.map((relation) => buildNote(relation, 'Added')),
    ...removedRelations.map((relation) => buildNote(relation, 'Removed'))
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
