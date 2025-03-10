export const toKeywordJson = (skosConcept) => {
  try {
  // Transform the data
    const transformedData = {
      id: 99999,
      prefLabel: 'todo',
      longName: 'todo',
      root: 'todo',
      broader: 'todo',
      narrowers: 'todo',
      related: 'todo',
      // eslint-disable-next-line no-underscore-dangle
      definition: skosConcept['skos:definition'] ? skosConcept['skos:definition']._text : '',
      reference: skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
        ? skosConcept['gcmd:reference']['@gcmd:text']
        : '',
      scheme: skosConcept['skos:inScheme']['@rdf:resource'].split('/').pop(),
      version: 'todo',
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
