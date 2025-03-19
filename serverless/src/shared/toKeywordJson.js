import { buildFullPath } from './buildFullPath'
import { cleanupJsonObject } from './cleanupJsonObject'
import { createChangeNoteItem } from './createChangeNoteItem'
import { getNumberOfCmrCollections } from './getNumberOfCmrCollections'
import { getVersionMetadata } from './getVersionMetadata'

export const processAltLabels = (altLabels) => {
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

  relations.sort((a, b) => {
    if (a.keyword.prefLabel < b.keyword.prefLabel) return -1
    if (a.keyword.prefLabel > b.keyword.prefLabel) return 1

    return 0
  })

  return relations
}

export const toKeywordJson = async (
  skosConcept,
  prefLabelMap
) => {
  console.log('skos=', skosConcept)
  const allAltLabels = processAltLabels(skosConcept['gcmd:altLabel'])
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
      related: processRelations(skosConcept, prefLabelMap),
      changeNotes
    }

    return cleanupJsonObject(transformedData)
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}
