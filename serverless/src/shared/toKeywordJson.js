import { buildFullPath } from './buildFullPath'
import { cleanupJsonObject } from './cleanupJsonObject'
import { getNumberOfCmrCollections } from './getNumberOfCmrCollections'
import toLegacyJSON from './toLegacyJSON'

/**
 * Processes alternative labels for a concept.
 *
 * @param {Array|Object} altLabels - The alternative labels to process.
 * @returns {Array} An array of processed alternative labels.
 *
 * @example
 * const altLabels = [
 *   { '@gcmd:category': 'primary', '@gcmd:text': 'Label 1', '@xml:lang': 'en' },
 *   { '@gcmd:text': 'Label 2', '@xml:lang': 'fr' }
 * ];
 * const result = getAltLabels(altLabels);
 * // Result: [
 * //   { category: 'primary', text: 'Label 1', languageCode: 'en' },
 * //   { text: 'Label 2', languageCode: 'fr' }
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
 * @param {string} note - The change note string to process.
 * @returns {Object} A structured change note object.
 *
 * @example
 * const note = `
 * Date: 2023-05-01
 * User Id: user123
 * User Note: Updated definition
 * Change Note Item #1
 * System Note: Definition updated
 * New Value: New definition text
 * Old Value: Old definition text
 * Entity: Definition
 * Operation: UPDATE
 * Field: definition
 * `;
 * const result = createChangeNote(note);
 * // Result: {
 * //   date: '2023-05-01',
 * //   userId: 'user123',
 * //   userNote: 'Updated definition',
 * //   changeNoteItems: [{
 * //     systemNote: 'Definition updated',
 * //     newValue: 'New definition text',
 * //     oldValue: 'Old definition text',
 * //     entity: 'Definition',
 * //     operation: 'UPDATE',
 * //     field: 'definition'
 * //   }]
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
    else if (line.startsWith('Change Note Item #')) {
      if (currentChangeNoteItem) {
        changeNote.changeNoteItems.push(currentChangeNoteItem)
      }

      currentChangeNoteItem = {}
    } else if (currentChangeNoteItem) {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':')
        const value = valueParts.join(':').trim()
        switch (key.trim()) {
          case 'System Note':
            currentChangeNoteItem.systemNote = value
            break
          case 'New Value':
            currentChangeNoteItem.newValue = currentChangeNoteItem.newValue
              ? `${currentChangeNoteItem.newValue}\n${value}`
              : value

            break
          case 'Old Value':
            currentChangeNoteItem.oldValue = currentChangeNoteItem.oldValue
              ? `${currentChangeNoteItem.oldValue}\n${value}`
              : value

            break
          case 'Entity':
            currentChangeNoteItem.entity = value
            break
          case 'Operation':
            currentChangeNoteItem.operation = value
            break
          case 'Field':
            currentChangeNoteItem.field = value
            break
          default:
            // Handle any unexpected keys
            console.warn(`Unexpected key in change note: ${key}`)
            break
        }
      } else if (currentChangeNoteItem.newValue || currentChangeNoteItem.oldValue) {
        // Append multi-line values
        if (currentChangeNoteItem.newValue) {
          currentChangeNoteItem.newValue += `\n${line}`
        }

        if (currentChangeNoteItem.oldValue) {
          currentChangeNoteItem.oldValue += `\n${line}`
        }
      }
    }
  })

  // Add the last ChangeNoteItem if it exists
  if (currentChangeNoteItem) {
    changeNote.changeNoteItems.push(currentChangeNoteItem)
  }

  return changeNote
}

/**
 * Processes an array of change notes.
 *
 * @param {Array|Object} changeNotes - The change notes to process.
 * @returns {Array} An array of processed change notes.
 *
 * @example
 * const changeNotes = [
 *   'Date: 2023-05-01\nUser Id: user123\nChange Note Item #1\nSystem Note: Updated',
 *   'Date: 2023-05-02\nUser Id: user456\nChange Note Item #1\nSystem Note: Created'
 * ];
 * const result = processChangeNotes(changeNotes);
 * // Result: [
 * //   { date: '2023-05-01', userId: 'user123', changeNoteItems: [{ systemNote: 'Updated' }] },
 * //   { date: '2023-05-02', userId: 'user456', changeNoteItems: [{ systemNote: 'Created' }] }
 * // ]
 */
export const processChangeNotes = (changeNotes) => {
  if (!changeNotes) return []

  const changeNotesArray = Array.isArray(changeNotes) ? changeNotes : [changeNotes]

  return changeNotesArray.map(createChangeNote)
}

/**
 * Processes relations for a concept.
 *
 * @param {Object} concept - The concept object.
 * @param {Map} prefLabelMap - A map of UUIDs to preferred labels.
 * @returns {Array} An array of processed relations.
 *
 * @example
 * const concept = {
 *   'gcmd:hasInstrument': [{ '@rdf:resource': 'uuid1' }],
 *   'gcmd:isOnPlatform': { '@rdf:resource': 'uuid2' }
 * };
 * const prefLabelMap = new Map([
 *   ['uuid1', 'Instrument 1'],
 *   ['uuid2', 'Platform 1']
 * ]);
 * const result = processRelations(concept, prefLabelMap);
 * // Result: [
 * //   { keyword: { uuid: 'uuid1', prefLabel: 'Instrument 1' }, relationshipType: 'has_instrument' },
 * //   { keyword: { uuid: 'uuid2', prefLabel: 'Platform 1' }, relationshipType: 'is_on_platform' }
 * // ]
 */
export const processRelations = (concept, prefLabelMap) => {
  const relations = []

  // Helper function to process a single relation
  const processRelation = (relation, type) => ({
    keyword: {
      uuid: relation['@rdf:resource'],
      prefLabel: prefLabelMap.get(relation['@rdf:resource'])
    },
    relationshipType: type
  })

  // Handle gcmd:hasInstrument
  if (concept['gcmd:hasInstrument']) {
    const instruments = Array.isArray(concept['gcmd:hasInstrument'])
      ? concept['gcmd:hasInstrument']
      : [concept['gcmd:hasInstrument']]
    relations.push(...instruments.map((instrument) => processRelation(instrument, 'has_instrument')))
  }

  // Handle gcmd:isOnPlatform
  if (concept['gcmd:isOnPlatform']) {
    const platforms = Array.isArray(concept['gcmd:isOnPlatform'])
      ? concept['gcmd:isOnPlatform']
      : [concept['gcmd:isOnPlatform']]
    relations.push(...platforms.map((platform) => processRelation(platform, 'is_on_platform')))
  }

  return relations
}

/**
 * Converts a SKOS concept to a JSON representation.
 *
 * @param {Object} skosConcept - The SKOS concept to convert.
 * @param {Object} conceptSchemeMap - A map of concept schemes.
 * @param {Map} prefLabelMap - A map of UUIDs to preferred labels.
 * @returns {Promise<Object>} A promise that resolves to the JSON representation of the concept.
 *
 * @example
 * const skosConcept = {
 *   '@rdf:about': 'uuid123',
 *   'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/earth_science' },
 *   'gcmd:altLabel': [{ '@gcmd:category': 'primary', '@gcmd:text': 'Earth Science', '@xml:lang': 'en' }],
 *   'skos:definition': { '_text': 'The study of Earth and its systems.' },
 *   'gcmd:reference': { '@gcmd:text': 'https://example.com/earth_science' },
 *   'skos:changeNote': 'Date: 2023-05-01\nUser Id: user123\nChange Note Item #1\nSystem Note: Created'
 * };
 * const conceptSchemeMap = {};
 * const prefLabelMap = new Map();
 *
 * const result = await toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap);
 * // Result: {
 * //   uuid: 'uuid123',
 * //   scheme: 'earth_science',
 * //   root: true,
 * //   longName: 'Earth Science',
 * //   altLabels: [{ category: 'primary', text: 'Earth Science', languageCode: 'en' }],
 * //   definition: 'The study of Earth and its systems.',
 * //   reference: 'https://example.com/earth_science',
 * //   changeNotes: [{ date: '2023-05-01', userId: 'user123', changeNoteItems: [{ systemNote: 'Created' }] }],
 * //   // ... other properties
 * // }
 */
export const toKeywordJson = async (
  skosConcept,
  conceptSchemeMap,
  conceptToConceptSchemeShortNameMap,
  prefLabelMap
) => {
  const allAltLabels = getAltLabels(skosConcept['gcmd:altLabel'])
  // Filter altLabels with category='primary'
  const primaryAltLabels = allAltLabels.filter((label) => label.category === 'primary')
  const scheme = skosConcept['skos:inScheme']['@rdf:resource'].split('/').pop()
  const uuid = skosConcept['@rdf:about']
  // First get the legacy json
  const legacyJson = toLegacyJSON(
    skosConcept,
    conceptSchemeMap,
    conceptToConceptSchemeShortNameMap,
    prefLabelMap
  )

  try {
    legacyJson.narrowers = legacyJson.narrower
    // Remove scheme from each narrower if the array exists and is not empty
    if (legacyJson.narrowers && Array.isArray(legacyJson.narrowers)
    && legacyJson.narrowers.length > 0) {
      legacyJson.narrowers = legacyJson.narrowers.map((narrower) => {
        if (narrower && typeof narrower === 'object') {
          const { scheme: narrowerScheme, ...narrowerWithoutScheme } = narrower

          return narrowerWithoutScheme
        }

        return narrower
      })
    } else {
      // If narrowers is null, undefined, or an empty array, set it to an empty array
      legacyJson.narrowers = []
    }

    const leafConcept = legacyJson.isLeaf
    const version = legacyJson.keywordVersion

    // Remove not used fields
    const {
      termsOfUse,
      definitions,
      narrower,
      keywordVersion,
      schemeVersion,
      viewer,
      isLeaf,
      lastModifiedDate,
      ...cleanedLegacyJson
    } = legacyJson

    cleanedLegacyJson.root = !skosConcept['skos:broader']
    cleanedLegacyJson.longName = primaryAltLabels && primaryAltLabels.length > 0 ? primaryAltLabels[0].text : ''
    cleanedLegacyJson.altLabels = allAltLabels
    cleanedLegacyJson.version = version
    cleanedLegacyJson.scheme = scheme
    cleanedLegacyJson.fullPath = await buildFullPath(uuid)

    cleanedLegacyJson.numberOfCollections = await getNumberOfCmrCollections({
      scheme,
      conceptId: cleanedLegacyJson.uuid,
      prefLabel: cleanedLegacyJson.prefLabel,
      fullPath: cleanedLegacyJson.fullPath,
      isLeaf: leafConcept
    })

    // eslint-disable-next-line no-underscore-dangle
    cleanedLegacyJson.definition = skosConcept['skos:definition'] ? skosConcept['skos:definition']._text : ''

    cleanedLegacyJson.reference = skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
      ? skosConcept['gcmd:reference']['@gcmd:text']
      : ''

    const unsortedChangeNotes = processChangeNotes(skosConcept['skos:changeNote'])
    cleanedLegacyJson.changeNotes = unsortedChangeNotes.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)

      return dateB - dateA // For descending order (most recent first)
    })

    cleanedLegacyJson.related = processRelations(skosConcept, prefLabelMap)

    if (cleanedLegacyJson.broader[0]) {
      cleanedLegacyJson.broader[0].scheme = {}
      const broader = cleanedLegacyJson.broader[0]
      cleanedLegacyJson.broader = broader
    }

    return cleanupJsonObject(cleanedLegacyJson)
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}
