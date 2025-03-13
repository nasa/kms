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
    const createChangeNote = (date, userId, userNote, changeNoteItems) => {
      let changeNoteText = `${date} [${userId}] ${userNote}`
      if (changeNoteItems) {
        const changeNoteItem = Array.isArray(changeNoteItems.changeNoteItem)
          ? changeNoteItems.changeNoteItem
          : [changeNoteItems.changeNoteItem]
        changeNoteItem.forEach((item) => {
          const { '@_systemNote': systemNote, '@_newValue': newValue } = item
          const decodedNewValue = decodeHtmlEntities(newValue || '').trim()
          changeNoteText += `\n${systemNote} (${decodedNewValue})`
        })
      }

      return changeNoteText
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

    concept['gcmd:reference'] = json.definitions.map((def) => ({
      '@_gcmd:text': def.reference,
      '@_xml:lang': 'en'
    }))

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

    concept['skos:related'] = json.related.map((rel) => ({
      '@_gcmd:type': rel.type === 'has_instrument' ? 'hasInstrument' : 'onPlatform',
      '@_rdf:resource': rel.uuid
    }))

    const { changeNotes } = xml.concept
    const changeNote = changeNotes?.changeNote

    if (Array.isArray(changeNote)) {
      concept['skos:changeNote'] = changeNote.map((note) => ({
        '#text': createChangeNote(note['@_date'], note['@_userId'], note['@_userNote'], note.changeNoteItems)
      }))
    } else if (changeNote) {
      concept['skos:changeNote'] = {
        '#text': createChangeNote(changeNote['@_date'], changeNote['@_userId'], changeNote['@_userNote'], changeNote.changeNoteItems)
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
      indentBy: '  '
    })

    const rdfString = builder.build(rdfObject)

    return rdfString
  } catch (error) {
    console.error('Error in toRDF:', error)
    throw error
  }
}

module.exports = { toRDF }
