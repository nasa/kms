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

const createChangeNote = (note) => {
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

  // In case the last ChangeNoteItem doesn't have a 'field' property
  if (currentChangeNoteItem) {
    changeNote.changeNoteItems.push(currentChangeNoteItem)
  }

  return changeNote
}

const processChangeNotes = (changeNotes) => {
  if (!changeNotes) return []

  const changeNotesArray = Array.isArray(changeNotes) ? changeNotes : [changeNotes]

  return changeNotesArray.map(createChangeNote)
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
      changeNotes: processChangeNotes(skosConcept['skos:changeNote'])
    }

    return transformedData
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}
