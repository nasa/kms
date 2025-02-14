/* eslint-disable import/no-extraneous-dependencies */
const { create } = require('xmlbuilder2')
const xml2js = require('xml2js')

// Example files to use with main() below for the purposes of testing skos:concept element output
// const jsonFileURL = 'https://gcmd.earthdata.nasa.gov/kms/concept/70cb0f31-5c7e-48c1-a145-b7b99f0709a7?format=json'
// const xmlFileURL = 'https://gcmd.earthdata.nasa.gov/kms/concept/70cb0f31-5c7e-48c1-a145-b7b99f0709a7?format=xml'
// const rootfragment = create({
//   version: '1.0',
//   encoding: 'UTF-8'
// })

/**
   * Combines information from JSON and XML files to create RDF.
   * @param {String} jsonURL url of json file
   * @param {String} xmlURL url of xml file
   * @returns new RDF
   */
const toRDF = async (jsonURL, xmlURL) => {
  try {
    const jsonResponse = await fetch(jsonURL)
    if (!jsonResponse.ok) {
      throw new Error(`HTTP error! status: ${jsonResponse.status}`)
    }

    const json = await jsonResponse.json()

    const xmlResponse = await fetch(xmlURL)
    if (!xmlResponse.ok) {
      throw new Error(`HTTP error! status: ${xmlResponse.status}`)
    }

    const xmlText = await xmlResponse.text()

    const parser = new xml2js.Parser({ explicitArray: false })
    const xml = await parser.parseStringPromise(xmlText)

    const fragment = create()

    const concept = fragment.ele('skos:Concept', {
      'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      'rdf:about': json.uuid,
      'xml:base': 'https://gcmd.earthdata.nasa.gov/kms/concept/',
      'xmlns:dcterms': 'http://purl.org/dc/terms/'
    })

    concept.ele('skos:inScheme', {
      'rdf:resource': `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${json.scheme.shortName}`
    })

    concept.ele('skos:prefLabel', { 'xml:lang': 'en' }).txt(json.prefLabel)

    const {
      altLabels,
      broader,
      definitions,
      lastModifiedDate,
      narrower,
      related,
      resources
    } = json

    const { concept: xmlConcept } = xml
    const { changeNotes } = xmlConcept
    const { changeNote } = changeNotes

    concept.ele('dcterms:modified').txt(lastModifiedDate)

    altLabels.forEach((label) => {
      concept.ele('skos:altLabel', {
        'gcmd:category': label.category,
        'gcmd:text': label.text,
        'xml:lang': 'en'
      })
    })

    definitions.forEach((definition) => {
      concept.ele('skos:definition', { 'xml:lang': 'en' }).txt(definition.text.replace(/\n/g, ''))
      concept.ele('gcmd:reference', {
        'gcmd:text': definition.reference,
        'xml:lang': 'en'
      })
    })

    resources.forEach((resource) => {
      concept.ele('gcmd:resource', {
        'gcmd:type': resource.type,
        'gcmd:url': resource.url
      })
    })

    broader.forEach((broad) => {
      concept.ele('skos:broader', { 'rdf:resource': broad.uuid })
    })

    narrower.forEach((narrow) => {
      concept.ele('skos:narrower', { 'rdf:resource': narrow.uuid })
    })

    related.forEach((rel) => {
      const { type, uuid } = rel

      if (type === 'has_instrument') {
        concept.ele('gcmd:hasInstrument', { 'rdf:resource': uuid })
      } else {
        concept.ele('gcmd:onPlatform', { 'rdf:resource': uuid })
      }
    })

    if (changeNote?.length !== undefined) {
      changeNote.forEach((note) => {
        if (note.changeNoteItems) {
          const { changeNoteItems } = note
          const {
            date, userId, userNote, status
          } = note.$
          let changeNoteText = `${date} [${userId}] ${userNote}`
          const { changeNoteItem } = changeNoteItems

          if (changeNoteItem?.$) {
            const { systemNote, newValue } = changeNoteItem.$
            changeNoteText += ` ${systemNote} (${newValue?.replace(/\n/g, '').trim()}); `
          } else {
            changeNoteItem.forEach((item) => {
              const { systemNote, newValue } = item.$
              changeNoteText += ` ${systemNote} (${newValue?.replace(/\n/g, '').trim()}); `
            })
          }

          concept.ele('skos:changeNote').att('gcmd:status', status).txt(changeNoteText)
        } else {
          const {
            status, userId, date, userNote
          } = note.$

          concept.ele('skos:changeNote').att('gcmd:status', status).txt(`${date} [${userId}] ${userNote}`)
        }
      })
    } else if (changeNote?.length) {
      const { changeNoteItems } = changeNote
      const {
        date, userId, userNote, status
      } = changeNote.$
      let changeNoteText = `${date} [${userId}] ${userNote}`
      const { changeNoteItem } = changeNoteItems

      if (changeNoteItem.$) {
        const { systemNote, newValue } = changeNoteItem.$
        changeNoteText += ` ${systemNote} (${newValue?.replace(/\n/g, '').trim()}); `
      } else {
        changeNoteItem.forEach((item) => {
          const { systemNote, newValue } = item.$
          changeNoteText += ` ${systemNote} (${newValue?.replace(/\n/g, '').trim()}); `
        })
      }

      concept.ele('skos:changeNote').att('gcmd:status', status).txt(changeNoteText)
    }

    const rdfString = fragment.end({ prettyPrint: true })

    return rdfString
  } catch (error) {
    console.error('Error in toRDF:', error)
    throw error
  }
}

module.exports = toRDF

// Run to test function above
// const main = async () => {
//   try {
//     const rdfString = await toRDF(jsonFileURL, xmlFileURL, rootfragment)
//     console.log('🚀 ~ main ~ rdfString:', rdfString)
//   } catch (error) {
//     console.error('Error in main:', error)
//   }
// }

// main()
