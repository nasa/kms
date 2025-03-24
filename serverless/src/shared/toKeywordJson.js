import { castArray } from 'lodash'

import { buildFullPath } from './buildFullPath'
import { createChangeNoteItem } from './createChangeNoteItem'
import { getNumberOfCmrCollections } from './getNumberOfCmrCollections'
import { getVersionMetadata } from './getVersionMetadata'
import { removeEmpty } from './removeEmpty'

/**
 * Converts a SKOS concept to JSON format.
 * @param {Object} skosConcept - The SKOS concept to convert.
 * @param {Map} prefLabelMap - A map of UUIDs to preferred labels.
 * @returns {Promise<Object>} A promise that resolves to the JSON representation of the concept.
 *
 * @example
 * const skosConcept = {
 *   '@rdf:about': 'uuid123',
 *   'skos:prefLabel': { _text: 'Concept 1' },
 *   'gcmd:altLabel': [{ '@gcmd:text': 'Alt Label 1', '@xml:lang': 'en' }],
 *   'skos:inScheme': { '@rdf:resource': 'scheme/example' },
 *   'skos:definition': { _text: 'This is a concept' }
 * };
 * const prefLabelMap = new Map([['uuid123', 'Concept 1']]);
 * const jsonConcept = await toKeywordJson(skosConcept, prefLabelMap);
 * // Result: {
 * //   uuid: 'uuid123',
 * //   prefLabel: 'Concept 1',
 * //   altLabels: [{ text: 'Alt Label 1', languageCode: 'en' }],
 * //   scheme: 'example',
 * //   definition: 'This is a concept',
 * * //   ... (other properties)
 * // }
 */
export const toKeywordJson = async (
  skosConcept,
  prefLabelMap
) => {
  const processRelations = () => {
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
    if (skosConcept['gcmd:hasInstrument']) {
      const instruments = castArray(skosConcept['gcmd:hasInstrument'])
      instruments.forEach((instrument) => relations.push(processRelation(instrument, 'has_instrument')))
    }

    // Handle gcmd:hasSensor
    if (skosConcept['gcmd:hasSensor']) {
      const sensors = castArray(skosConcept['gcmd:hasSensor'])
      sensors.forEach((sensor) => relations.push(processRelation(sensor, 'has_sensor')))
    }

    // Handle gcmd:isOnPlatform
    if (skosConcept['gcmd:isOnPlatform']) {
      const platforms = castArray(skosConcept['gcmd:isOnPlatform'])
      platforms.forEach((platform) => relations.push(processRelation(platform, 'is_on_platform')))
    }

    // Handle skos:related
    if (skosConcept['skos:related']) {
      const related = castArray(skosConcept['skos:related'])
      related.forEach((relatedItem) => relations.push(processRelation(relatedItem, null)))
    }

    relations.sort((a, b) => {
      if (a.keyword.prefLabel < b.keyword.prefLabel) return -1
      if (a.keyword.prefLabel > b.keyword.prefLabel) return 1

      return 0
    })

    return relations
  }

  const processAltLabels = () => {
    const altLabels = skosConcept['gcmd:altLabel']

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

  const allAltLabels = processAltLabels()
  // Filter altLabels with category='primary'
  const primaryAltLabels = allAltLabels.filter((label) => label.category === 'primary')
  const scheme = skosConcept['skos:inScheme']['@rdf:resource'].split('/').pop()
  const uuid = skosConcept['@rdf:about']
  // eslint-disable-next-line no-underscore-dangle
  const prefLabel = skosConcept['skos:prefLabel']._text
  const isLeaf = !skosConcept['skos:narrower']
  const versionObj = await getVersionMetadata('published')
  const version = versionObj.versionName
  const fullPath = await buildFullPath(uuid)
  const narrowers = (() => {
    const narrower = skosConcept['skos:narrower']
    if (!narrower) return []

    const narrowerArray = Array.isArray(narrower) ? narrower : [narrower]

    return narrowerArray.map((narrow) => ({
      uuid: narrow['@rdf:resource'],
      prefLabel: prefLabelMap.get(narrow['@rdf:resource'])
    }))
  })()
  narrowers.sort((a, b) => {
    if (a.prefLabel < b.prefLabel) return -1
    if (a.prefLabel > b.prefLabel) return 1

    return 0
  })

  const changeNotes = (() => {
    if (!skosConcept['skos:changeNote']) return []

    const changeNoteArray = Array.isArray(skosConcept['skos:changeNote'])
      ? skosConcept['skos:changeNote']
      : [skosConcept['skos:changeNote']]

    return changeNoteArray.map((note) => createChangeNoteItem(note))
  })()
  changeNotes.sort((a, b) => {
    if (a.date < b.date) return 1
    if (a.date > b.date) return -1

    return 0
  })

  try {
    // Transform the data
    const transformedData = {
      uuid,
      prefLabel,
      altLabels: allAltLabels,
      longName: primaryAltLabels && primaryAltLabels.length > 0 ? primaryAltLabels[0].text : '',
      root: !skosConcept['skos:broader'],
      numberOfCollections: await getNumberOfCmrCollections({
        scheme,
        uuid,
        prefLabel,
        fullPath,
        isLeaf
      }),
      scheme,
      broader: skosConcept['skos:broader'] ? {
        uuid: skosConcept['skos:broader']['@rdf:resource'],
        prefLabel: prefLabelMap.get(skosConcept['skos:broader']['@rdf:resource'])
      } : {},
      version,
      fullPath,
      // eslint-disable-next-line no-underscore-dangle
      definition: skosConcept['skos:definition'] ? skosConcept['skos:definition']._text : '',
      reference: skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
        ? skosConcept['gcmd:reference']['@gcmd:text']
        : '',
      resources: skosConcept['gcmd:resource'] ? [{
        type: skosConcept['gcmd:resource']['@gcmd:type'],
        url: skosConcept['gcmd:resource']['@gcmd:url']
      }] : [],
      narrowers,
      related: processRelations(),
      changeNotes
    }

    return removeEmpty(transformedData)
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}
