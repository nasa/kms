import { buildFullPath } from './buildFullPath'
import { getNumberOfCmrCollections } from './getNumberOfCmrCollections'

const getAltLabels = (altLabels) => {
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

const getNarrowers = (skosConcept, prefLabelMap) => {
  const narrower = skosConcept['skos:narrower']
  if (!narrower) return []

  const narrowerArray = Array.isArray(narrower) ? narrower : [narrower]

  return narrowerArray.map((narrow) => ({
    prefLabel: prefLabelMap.get(narrow['@rdf:resource']),
    uuid: narrow['@rdf:resource']
  }))
}

const getRelated = (skosConcept, prefLabelMap) => {
  const related = skosConcept['skos:related']
  if (!related) return []

  const relatedArray = Array.isArray(related) ? related : [related]

  return relatedArray.map((relation) => ({
    keyword: {
      prefLabel: prefLabelMap.get(relation['@rdf:resource']),
      uuid: relation['@rdf:resource']
    },
    relationshipType: skosConcept['gcmd:type'].replace(/([A-Z])/g, '_$1').toLowerCase()
  }))
}

export const toKeywordJson = async (skosConcept, prefLabelMap) => {
  const allAltLabels = getAltLabels(skosConcept['gcmd:altLabel'])
  // Filter altLabels with category='primary'
  const primaryAltLabels = allAltLabels.filter((label) => label.category === 'primary')
  const scheme = skosConcept['skos:inScheme']['@rdf:resource'].split('/').pop()
  const uuid = skosConcept['@rdf:about']
  // eslint-disable-next-line no-underscore-dangle
  const prefLabel = skosConcept['skos:prefLabel']._text
  try {
  // Transform the data
    const transformedData = {
      id: 99999,
      // eslint-disable-next-line no-underscore-dangle
      prefLabel,
      longName: primaryAltLabels && primaryAltLabels.length > 0 ? primaryAltLabels[0].text : '',
      altLabels: allAltLabels,
      root: !skosConcept['skos:broader'],
      scheme,
      version: '20.6',
      numberOfCollections: await getNumberOfCmrCollections({
        scheme,
        conceptId: uuid,
        prefLabel
      }),
      uuid,
      fullPath: await buildFullPath(uuid),
      // eslint-disable-next-line no-underscore-dangle
      definition: skosConcept['skos:definition'] ? skosConcept['skos:definition']._text : '',
      reference: skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
        ? skosConcept['gcmd:reference']['@gcmd:text']
        : '',
      broader: skosConcept['skos:broader'] ? {
        prefLabel: prefLabelMap.get(skosConcept['skos:broader']['@rdf:resource']),
        uuid: skosConcept['skos:broader']['@rdf:resource']
      } : {},
      narrowers: skosConcept['skos:narrower'] ? getNarrowers(skosConcept, prefLabelMap) : [],
      related: skosConcept['skos:related'] ? getRelated(skosConcept, prefLabelMap) : [],
      changeNotes: 'todo'
    }

    return transformedData
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}
