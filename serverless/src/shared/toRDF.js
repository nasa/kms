import { XMLBuilder } from 'fast-xml-parser'
import { decode } from 'html-entities'

/**
 * Synthesizes information from JSON and XML data into one RDF skos:concept.
 *
 * This function takes JSON and XML representations of a concept and combines them
 * into a single RDF/XML representation of a SKOS concept.
 *
 * @function toRDF
 * @param {Object} json - The JSON representation of the concept.
 * @param {Object} xml - The XML representation of the concept.
 * @returns {string} The RDF/XML string representation of the SKOS concept.
 * @throws {Error} If the JSON or XML input is invalid, or if there's an error during processing.
 *
 * @example
 * const json = { uuid: '123', prefLabel: 'Example Concept', ... };
 * const xml = { creationDate: '2023-01-01', ... };
 * const rdfXml = toRDF(json, xml);
 */
export const toRDF = (json, xml) => {
  try {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON input')
    }

    if (!xml || typeof xml !== 'object') {
      throw new Error('Invalid XML input')
    }

    // Reads raw text and changes it from a literal string to a formated one
    const decodeHtmlEntities = (text) => decode(text)

    const addText = (fieldName, value, newline) => {
      if (value) {
        const str = (decodeHtmlEntities(value) || '').trim()
        if (str.length > 0) {
          if (newline) {
            return `\n${fieldName}=${str}`
          }

          return `${fieldName}=${str} `
        }
      }

      return ''
    }

    // Helper function to provide information for <skos:changeNote> based on what the xml data looks like
    // It also adds attributes for easier parsing
    const createChangeNotes = (date, userId, userNote, changeNoteItems) => {
      if (changeNoteItems && changeNoteItems.changeNoteItem) {
        const changeNoteItem = Array.isArray(changeNoteItems.changeNoteItem)
          ? changeNoteItems.changeNoteItem
          : [changeNoteItems.changeNoteItem]

        return changeNoteItem.map((item) => {
          let changeNoteText = ''
          const {
            '@_systemNote': systemNote = '',
            '@_newValue': newValue = '',
            '@_oldValue': oldValue = '',
            '@_entity': entity = '',
            '@_operation': operation = '',
            '@_field': field = ''
          } = item || {}

          changeNoteText += addText('Date', date, false)
          changeNoteText += addText('User Id', userId, false)
          changeNoteText += addText('Entity', entity, false)
          changeNoteText += addText('Operation', operation, false)
          changeNoteText += addText('Field', field, false)
          changeNoteText += addText('User Note', userNote, true)
          changeNoteText += addText('System Note', systemNote, true)
          changeNoteText += addText('Old Value', oldValue, true)
          changeNoteText += addText('New Value', newValue, true)

          return changeNoteText.trim()
        }).filter((note) => note !== '')
      }

      return []
    }

    const concept = {
      '@_xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '@_xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      '@_rdf:about': json.uuid,
      '@_xml:base': 'https://gcmd.earthdata.nasa.gov/kms/concept/',
      '@_xmlns:dcterms': 'http://purl.org/dc/terms/',
      'skos:inScheme': {
        '@_rdf:resource': `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${json.scheme.shortName}`
      }
    }

    if (json.prefLabel) {
      concept['skos:prefLabel'] = {
        '@_xml:lang': 'en',
        '#text': json.prefLabel
      }
    }

    if (json.lastModifiedDate) {
      concept['dcterms:modified'] = json.lastModifiedDate
    }

    if (xml.creationDate) {
      concept['dcterms:created'] = xml.creationDate
    }

    if (json.altLabels && Array.isArray(json.altLabels)) {
      concept['gcmd:altLabel'] = json.altLabels.map((label) => ({
        '@_gcmd:category': label.category,
        '@_gcmd:text': label.text,
        '@_xml:lang': 'en'
      }))
    }

    if (json.definitions && Array.isArray(json.definitions)) {
      concept['skos:definition'] = json.definitions.map((def) => ({
        '@_xml:lang': 'en',
        '#text': def.text.replace(/\n/g, '')
      }))
    }

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

    if (json.resources && Array.isArray(json.resources)) {
      concept['gcmd:resource'] = json.resources.map((resource) => ({
        '@_gcmd:type': resource.type,
        '@_gcmd:url': resource.url
      }))
    }

    if (json.broader && Array.isArray(json.broader)) {
      concept['skos:broader'] = json.broader.map((broad) => ({
        '@_rdf:resource': broad.uuid
      }))
    }

    if (json.narrower && Array.isArray(json.narrower)) {
      concept['skos:narrower'] = json.narrower.map((narrow) => ({
        '@_rdf:resource': narrow.uuid
      }))
    }

    const relateds = ['gcmd:hasInstrument', 'gcmd:isOnPlatform', 'gcmd:hasSensor', 'skos:related']
    relateds.forEach((related) => {
      concept[related] = []
    })

    const source = json.scheme.shortName

    json.related?.forEach((rel) => {
      const { scheme } = rel
      const { shortName: target } = scheme

      let found = false
      if (source === 'platforms' && target === 'instruments') {
        concept['gcmd:hasInstrument'].push({
          '@_rdf:resource': rel.uuid
        })

        found = true
      }

      if (source === 'instruments' && target === 'platforms') {
        concept['gcmd:isOnPlatform'].push({
          '@_rdf:resource': rel.uuid
        })

        found = true
      }

      if (source === 'instruments' && target === 'instruments') {
        concept['gcmd:hasSensor'].push({
          '@_rdf:resource': rel.uuid
        })

        found = true
      }

      if (!found) {
        concept['skos:related'].push({
          '@_rdf:resource': rel.uuid
        })
      }
    })

    // Remove empty arrays
    relateds.forEach((related) => {
      if (concept[related].length === 0) {
        delete concept[related]
      }
    })

    const { changeNotes } = xml
    let changeNote = changeNotes?.changeNote
    if (changeNote) {
      if (!Array.isArray(changeNote)) {
        changeNote = [changeNote]
      }

      const allNotes = changeNote.flatMap((note) => createChangeNotes(note['@_date'], note['@_userId'], note['@_userNote'], note.changeNoteItems))

      if (allNotes.length > 0) {
        concept['skos:changeNote'] = allNotes.map((note) => ({ '#text': note }))
      }
    }

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      suppressEmptyNode: true,
      indentBy: ' ',
      tagValueProcessor: (tagName, tagValue) => String(tagValue)
    })

    const rdfString = builder.build({ 'skos:Concept': concept })

    return rdfString
  } catch (error) {
    console.error('Error in toRDF:', error)
    throw error
  }
}
