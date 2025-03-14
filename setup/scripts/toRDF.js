const { XMLParser, XMLBuilder } = require('fast-xml-parser')

// Synthesizes information from jsonURL and xmlURL into one RDF skos:concept
const toRDF = async (jsonURL, xmlURL) => {
  try {
    const jsonResponse = await fetch(jsonURL)
    const json = await jsonResponse.json()

    const xmlResponse = await fetch(xmlURL)
    const xmlText = await xmlResponse.text()

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    })
    const xml = parser.parse(xmlText)

    // Reads raw text and changes it from a literal string to a formated one
    const decodeHtmlEntities = (text) => text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))

    // Helper function to provide information for <skos:changeNote> based on what the xml data looks like
    // It also adds attributes for easier parsing
    const createChangeNoteforToRDF = (date, userId, userNote, changeNoteItems) => {
      let changeNoteText = 'Change Note Information\n \n'
      changeNoteText += `Date: ${date}\n`
      changeNoteText += `User Id: ${userId}\n`
      changeNoteText += `User Note: ${userNote}\n`

      if (changeNoteItems) {
        const changeNoteItem = Array.isArray(changeNoteItems.changeNoteItem)
          ? changeNoteItems.changeNoteItem
          : [changeNoteItems.changeNoteItem]

        changeNoteItem.forEach((item, index) => {
          if (index >= 0) changeNoteText += `\n Change Note Item #${index + 1}\n \n`
          const {
            '@_systemNote': systemNote,
            '@_newValue': newValue,
            '@_oldValue': oldValue,
            '@_entity': entity,
            '@_operation': operation,
            '@_field': field
          } = item
          const decodedNewValue = decodeHtmlEntities(newValue || '').trim()
          const decodedOldValue = decodeHtmlEntities(oldValue || '').trim()
          changeNoteText += `System Note: ${systemNote}\n`
          changeNoteText += `New Value: ${decodedNewValue}\n`
          if (oldValue) changeNoteText += `Old Value: ${decodedOldValue}\n`
          changeNoteText += `Entity: ${entity}\n`
          changeNoteText += `Operation: ${operation}\n`
          if (field) changeNoteText += `Field: ${field}\n`
        })
      }

      return changeNoteText.trim()
    }

    const concept = {
      '@_xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '@_xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      '@_rdf:about': json.uuid,
      '@_xml:base': 'https://gcmd.earthdata.nasa.gov/kms/concept/',
      '@_xmlns:dcterms': 'http://purl.org/dc/terms/',
      'skos:inScheme': {
        '@_rdf:resource': `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${json.scheme.shortName}`
      },
      'skos:prefLabel': {
        '@_xml:lang': 'en',
        '#text': json.prefLabel
      }
    }

    if (json.lastModifiedDate) {
      concept['dcterms:modified'] = json.lastModifiedDate
    }

    if (xml.concept.creationDate) {
      concept['dcterms:created'] = xml.concept.creationDate
    }

    concept['gcmd:altLabel'] = json.altLabels.map((label) => ({
      '@_gcmd:category': label.category,
      '@_gcmd:text': label.text,
      '@_xml:lang': 'en'
    }))

    concept['skos:definition'] = json.definitions.map((def) => ({
      '@_xml:lang': 'en',
      '#text': def.text.replace(/\n/g, '')
    }))

    // If the gcmd:text for reference is "", don't print out reference. There is only ever on definition so no need to map
    if (json.definitions
      && Array.isArray(json.definitions)
      && json.definitions.length > 0
      && json.definitions[0].reference
      && json.definitions[0].reference.trim() !== '') {
      concept['gcmd:reference'] = {
        '@_gcmd:text': json.definitions[0].reference,
        '@_xml:lang': 'en'
      }
    } else {
      delete concept['gcmd:reference']
    }

    concept['gcmd:resource'] = json.resources.map((resource) => ({
      '@_gcmd:type': resource.type,
      '@_gcmd:url': resource.url
    }))

    concept['skos:broader'] = json.broader.map((broad) => ({
      '@_rdf:resource': broad.uuid
    }))

    concept['skos:narrower'] = json.narrower.map((narrow) => ({
      '@_rdf:resource': narrow.uuid
    }))

    concept['gcmd:hasInstrument'] = []
    concept['gcmd:isOnPlatform'] = []

    json.related.forEach((rel) => {
      const { scheme } = rel
      const { shortName } = scheme
      if (shortName === 'instruments') {
        concept['gcmd:hasInstrument'].push({
          '@_rdf:resource': rel.uuid
        })
      } else {
        concept['gcmd:isOnPlatform'].push({
          '@_rdf:resource': rel.uuid
        })
      }
    })

    // Remove empty arrays
    if (concept['gcmd:hasInstrument'].length === 0) {
      delete concept['gcmd:hasInstrument']
    }

    if (concept['gcmd:isOnPlatform'].length === 0) {
      delete concept['gcmd:isOnPlatform']
    }

    const { changeNotes } = xml.concept
    const changeNote = changeNotes?.changeNote

    if (Array.isArray(changeNote)) {
      concept['skos:changeNote'] = changeNote.map((note) => ({
        '#text': `\n${createChangeNoteforToRDF(note['@_date'], note['@_userId'], note['@_userNote'], note.changeNoteItems)}`
      }))
    } else if (changeNote) {
      concept['skos:changeNote'] = {
        '#text': `\n${createChangeNoteforToRDF(
          changeNote['@_date'],
          changeNote['@_userId'],
          changeNote['@_userNote'],
          changeNote.changeNoteItems
        )}`
      }
    }

    const rdfObject = {
      'rdf:RDF': {
        'skos:Concept': concept
      }
    }

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      suppressEmptyNode: true,
      indentBy: ' ',
      tagValueProcessor: (tagName, tagValue) => {
        if (tagValue === null) {
          return ''
        }

        return tagValue
      }
    })

    const rdfString = builder.build(rdfObject)

    return rdfString
  } catch (error) {
    console.error('Error in toRDF:', error)
    throw error
  }
}

module.exports = { toRDF }
