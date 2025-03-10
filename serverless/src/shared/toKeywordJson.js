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

export const toKeywordJson = (skosConcept, prefLabelMap) => {
  const allAltLabels = getAltLabels(skosConcept['gcmd:altLabel'])
  // Filter altLabels with category='primary'
  const primaryAltLabels = allAltLabels.filter((label) => label.category === 'primary')
  try {
  // Transform the data
    const transformedData = {
      id: 99999,
      // eslint-disable-next-line no-underscore-dangle
      prefLabel: skosConcept['skos:prefLabel']._text,
      longName: primaryAltLabels?.[0].text ?? '',
      altLabels: allAltLabels,
      root: !skosConcept['skos:broader'],
      broader: skosConcept['skos:broader'] ? {
        prefLabel: prefLabelMap.get(skosConcept['skos:broader']['@rdf:resource']),
        uuid: skosConcept['skos:broader']['@rdf:resource']
      } : {},
      narrowers: skosConcept['skos:narrower'] ? getNarrowers(skosConcept, prefLabelMap) : [],
      related: skosConcept['skos:related'] ? getRelated(skosConcept, prefLabelMap) : [],
      // http://localhost:4001/dev/keyword/d3a21a28-538b-4292-9570-5fd3da9ce4d2
      // eslint-disable-next-line no-underscore-dangle
      definition: skosConcept['skos:definition'] ? skosConcept['skos:definition']._text : '',
      reference: skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
        ? skosConcept['gcmd:reference']['@gcmd:text']
        : '',
      scheme: skosConcept['skos:inScheme']['@rdf:resource'].split('/').pop(),
      version: '20.6',
      numberOfCollections: 'todo',
      uuid: skosConcept['@rdf:about'],
      fullPath: 'todo',
      changeNotes: 'todo'
    }

    return transformedData
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}
