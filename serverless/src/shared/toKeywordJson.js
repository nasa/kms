import { buildFullPath } from './buildFullPath'
import { cleanupJsonObject } from './cleanupJsonObject'
import { getNumberOfCmrCollections } from './getNumberOfCmrCollections'
import toLegacyJSON from './toLegacyJSON'

/**
 * Processes the related concepts of a SKOS concept and formats them.
 *
 * @param {Object} skosConcept - The SKOS concept object containing related concepts.
 * @param {Map} prefLabelMap - A map of preferred labels keyed by concept UUID.
 * @returns {Array} An array of processed related concept objects.
 *
 * @example
 * const skosConcept = {
 *   'skos:related': [
 *     { '@rdf:resource': 'http://example.com/concept/1' },
 *     { '@rdf:resource': 'http://example.com/concept/2' }
 *   ],
 *   'gcmd:type': 'SomeRelationType'
 * };
 * const prefLabelMap = new Map([
 *   ['http://example.com/concept/1', 'Related Concept 1'],
 *   ['http://example.com/concept/2', 'Related Concept 2']
 * ]);
 * const relatedConcepts = processRelated(skosConcept, prefLabelMap);
 * console.log(relatedConcepts);
 * // Output:
 * // [
 * //   {
 * //     keyword: {
 * //       uuid: 'http://example.com/concept/1',
 * //       prefLabel: 'Related Concept 1'
 * //     },
 * //     relationshipType: 'some_relation_type'
 * //   },
 * //   {
 * //     keyword: {
 * //       uuid: 'http://example.com/concept/2',
 * //       prefLabel: 'Related Concept 2'
 * //     },
 * //     relationshipType: 'some_relation_type'
 * //   }
 * // ]
 */
export const processRelated = (skosConcept, prefLabelMap) => (
  (skosConcept['skos:related'] || []).map((relation) => ({
    keyword: {
      uuid: relation['@rdf:resource'],
      prefLabel: prefLabelMap.get(relation['@rdf:resource'])
    },
    relationshipType: skosConcept['gcmd:type'].replace(/([A-Z])/g, '_$1').toLowerCase()
  }))
)

/**
 * Processes and formats alt labels from a SKOS concept.
 *
 * @param {Array|Object} altLabels - The alt labels to process.
 * @returns {Array} An array of processed alt labels.
 *
 * @example
 * const altLabels = [
 *   { '@gcmd:category': 'primary', '@gcmd:text': 'Example Alt Label', '@xml:lang': 'en' },
 *   { '@gcmd:text': 'Another Label', '@xml:lang': 'fr' }
 * ];
 * const processedLabels = getAltLabels(altLabels);
 * console.log(processedLabels);
 * // Output:
 * // [
 * //   { category: 'primary', text: 'Example Alt Label', languageCode: 'en' },
 * //   { text: 'Another Label', languageCode: 'fr' }
 * // ]
 */
export const getAltLabels = (altLabels) => {
  if (!altLabels) {
    return []
  }

  const labelArray = Array.isArray(altLabels) ? altLabels : [altLabels]

  return labelArray.map((label) => {
    const processedLabel = {}

    if (label['@gcmd:category']) {
      processedLabel.category = label['@gcmd:category']
    }

    processedLabel.text = label['@gcmd:text']

    processedLabel.languageCode = label['@xml:lang']

    return processedLabel
  })
}

/**
 * Creates a change note object from a string.
 *
 * @param {string} note - The change note string.
 * @returns {Object} A structured change note object.
 *
 * @example
 * const noteString = `
 * Date: 2023-06-01
 * User Id: user123
 * User Note: Updated concept
 * Change Note Item
 * System Note: Modified prefLabel
 * Old Value: Old Label
 * New Value: New Label
 * Entity: Concept
 * Operation: Update
 * Field: prefLabel
 * `;
 * const changeNote = createChangeNote(noteString);
 * console.log(changeNote);
 * // Output:
 * // {
 * //   date: '2023-06-01',
 * //   userId: 'user123',
 * //   userNote: 'Updated concept',
 * //   changeNoteItems: [
 * //     {
 * //       systemNote: 'Modified prefLabel',
 * //       oldValue: 'Old Label',
 * //       newValue: 'New Label',
 * //       entity: 'Concept',
 * //       operation: 'Update',
 * //       field: 'prefLabel'
 * //     }
 * //   ]
 * // }
 */
export const createChangeNote = (note) => {
  const lines = note.split('\n').map((line) => line.trim())
  const changeNote = {
    changeNoteItems: []
  }
  let currentChangeNoteItem = null

  lines.forEach((line) => {
    if (line.startsWith('Date:')) changeNote.date = line.split(':')[1].trim()
    else if (line.startsWith('User Id:')) changeNote.userId = line.split(':')[1].trim()
    else if (line.startsWith('User Note:')) changeNote.userNote = line.split(':')[1].trim() || ''
    else if (line.startsWith('Change Note Item')) {
      if (currentChangeNoteItem) {
        changeNote.changeNoteItems.changeNoteItem.push(currentChangeNoteItem)
      }

      currentChangeNoteItem = {}
    } else if (currentChangeNoteItem) {
      const [key, ...valueParts] = line.split(':')
      const value = valueParts.join(':').trim()
      if (key === 'System Note') currentChangeNoteItem.systemNote = value
      else if (key === 'Old Value') currentChangeNoteItem.oldValue = value
      else if (key === 'New Value') currentChangeNoteItem.newValue = value
      else if (key === 'Entity') currentChangeNoteItem.entity = value
      else if (key === 'Operation') currentChangeNoteItem.operation = value
      else if (key === 'Field') currentChangeNoteItem.field = value
    }
  })

  if (currentChangeNoteItem) {
    changeNote.changeNoteItems.push(currentChangeNoteItem)
  }

  return changeNote
}

/**
 * Processes all change notes for a SKOS concept.
 *
 * @param {Array|Object} changeNotes - The change notes to process.
 * @returns {Array} An array of processed change note objects.
 *
 * @example
 * const changeNotes = [
 *   'Date: 2023-06-01\nUser Id: user123\nChange Note Item\nOperation: Add\nField: prefLabel',
 *   'Date: 2023-06-02\nUser Id: user456\nChange Note Item\nOperation: Update\nField: definition'
 * ];
 * const processedNotes = processChangeNotes(changeNotes);
 * console.log(processedNotes);
 * // Output:
 * // [
 * //   {
 * //     date: '2023-06-01',
 * //     userId: 'user123',
 * //     changeNoteItems: [{ operation: 'Add', field: 'prefLabel' }]
 * //   },
 * //   {
 * //     date: '2023-06-02',
 * //     userId: 'user456',
 * //     changeNoteItems: [{ operation: 'Update', field: 'definition' }]
 * //   }
 * // ]
 */
export const processChangeNotes = (changeNotes) => {
  if (!changeNotes) return []

  const changeNotesArray = Array.isArray(changeNotes) ? changeNotes : [changeNotes]

  return changeNotesArray.map(createChangeNote)
}

/**
 * Converts a SKOS concept to a JSON representation of a keyword.
 *
 * @param {Object} skosConcept - The SKOS concept object to convert.
 * @param {Map} conceptSchemeMap - A map of concept schemes.
 * @param {Map} prefLabelMap - A map of preferred labels.
 * @returns {Promise<Object>} A promise that resolves to the JSON representation of the keyword.
 *
 * @example
 * const skosConcept = {
 *   '@rdf:about': 'http://example.com/concept/1',
 *   'skos:prefLabel': { '@xml:lang': 'en', '#text': 'Example Concept' },
 *   'gcmd:altLabel': [
 *     { '@gcmd:category': 'primary', '@gcmd:text': 'Example Alt Label', '@xml:lang': 'en' }
 *   ],
 *   'skos:inScheme': { '@rdf:resource': 'http://example.com/scheme/1' },
 *   'skos:definition': { '_text': 'This is an example concept' },
 *   'gcmd:reference': { '@gcmd:text': 'Example reference' },
 *   'skos:changeNote': 'Date: 2023-06-01\nUser Id: user123\nChange Note Item\nOperation: Add\nField: prefLabel'
 * };
 *
 * const conceptSchemeMap = new Map();
 * const prefLabelMap = new Map();
 *
 * const keywordJson = await toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap);
 * console.log(keywordJson);
 * // Output:
 * // {
 * //   root: true,
 * //   longName: 'Example Alt Label',
 * //   altLabels: [{ category: 'primary', text: 'Example Alt Label', languageCode: 'en' }],
 * //   scheme: '1',
 * //   fullPath: '/Example Concept',
 * //   numberOfCollections: 0,
 * //   definition: 'This is an example concept',
 * //   reference: 'Example reference',
 * //   definitions: [],
 * //   changeNotes: [{
 * //     date: '2023-06-01',
 * //     userId: 'user123',
 * //     changeNoteItems: [{ operation: 'Add', field: 'prefLabel' }]
 * //   }],
 * //   narrowers: [],
 * //   narrower: [],
 * //   related: []
 * // }
 */
export const toKeywordJson = async (skosConcept, conceptSchemeMap, prefLabelMap) => {
  const allAltLabels = getAltLabels(skosConcept['gcmd:altLabel'])
  // Filter altLabels with category='primary'
  const primaryAltLabels = allAltLabels.filter((label) => label.category === 'primary')
  const scheme = skosConcept['skos:inScheme']['@rdf:resource'].split('/').pop()
  const uuid = skosConcept['@rdf:about']
  // First get the legacy json
  const legacyJson = toLegacyJSON(skosConcept, conceptSchemeMap, prefLabelMap)

  try {
    legacyJson.root = !skosConcept['skos:broader']
    legacyJson.longName = primaryAltLabels && primaryAltLabels.length > 0 ? primaryAltLabels[0].text : ''
    legacyJson.altLabels = allAltLabels
    legacyJson.scheme = scheme
    legacyJson.fullPath = await buildFullPath(uuid)

    legacyJson.numberOfCollections = await getNumberOfCmrCollections({
      scheme,
      uuid: legacyJson.uuid,
      prefLabel: legacyJson.prefLabel
    })

    // eslint-disable-next-line no-underscore-dangle
    legacyJson.definition = skosConcept['skos:definition'] ? skosConcept['skos:definition']._text : ''

    legacyJson.reference = skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
      ? skosConcept['gcmd:reference']['@gcmd:text']
      : ''

    legacyJson.definitions = []

    legacyJson.changeNotes = processChangeNotes(skosConcept['skos:changeNote'])

    legacyJson.narrowers = legacyJson.narrower
    legacyJson.narrower = []

    legacyJson.related = processRelated(skosConcept, prefLabelMap)

    return cleanupJsonObject(legacyJson)
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}
