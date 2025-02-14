/* eslint-disable import/no-extraneous-dependencies */
const xml2js = require('xml2js')
const { create } = require('xmlbuilder2')

// Example files to use with main() below for the purposes of testing skos:concept element output
// const jsonFileURL = 'https://gcmd.earthdata.nasa.gov/kms/concept/00c0412e-b0d6-401d-8945-efd2dcdeb022?format=json'
// const xmlFileURL = 'https://gcmd.earthdata.nasa.gov/kms/concept/00c0412e-b0d6-401d-8945-efd2dcdeb022?format=xml'
// const rootfragment = create({
//   version: '1.0',
//   encoding: 'UTF-8'
// })

const maxRetries = 3
const retryDelay = 5000 // 5 seconds

// eslint-disable-next-line no-promise-executor-return
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithRetry = async (url, retries = 0) => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response
  } catch (error) {
    if (retries < maxRetries) {
      console.log(`Fetch failed. Retrying in ${retryDelay / 1000} seconds... (Attempt ${retries + 1}/${maxRetries})`)
      await delay(retryDelay)

      return fetchWithRetry(url, retries + 1)
    }

    throw error
  }
}

/**
   * Combines information from JSON and XML files to create RDF.
   * @param {String} jsonURL url of json file
   * @param {String} xmlURL url of xml file
   * @returns new RDF
   */
const toRDF = async (jsonURL, xmlURL) => {
  try {
    const jsonResponse = await fetchWithRetry(jsonURL)
    if (!jsonResponse.ok) {
      throw new Error(`HTTP error! status: ${jsonResponse.status}`)
    }

    const json = await jsonResponse.json()

    const xmlResponse = await fetchWithRetry(xmlURL)
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
    const { changeNotes, creationDate, altSymbols } = xmlConcept
    const { changeNote } = changeNotes

    if (altSymbols) {
      console.log(altSymbols)
      console.log(json.uuid)
    }

    if (lastModifiedDate) {
      concept.ele('dcterms:modified').txt(lastModifiedDate)
    }

    if (creationDate) {
      concept.ele('dcterms:created').txt(creationDate)
    }

    altLabels.forEach((label) => {
      concept.ele('skos:altLabel', {
        'gcmd:category': label.category,
        'xml:lang': 'en'
      }).txt(label.text)
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
            date, userId, userNote
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

          concept.ele('skos:changeNote').txt(changeNoteText)
        } else {
          const {
            userId, date, userNote
          } = note.$

          concept.ele('skos:changeNote').txt(`${date} [${userId}] ${userNote}`)
        }
      })
    } else if (changeNote?.length) {
      const { changeNoteItems } = changeNote
      const {
        date, userId, userNote
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

      concept.ele('skos:changeNote').txt(changeNoteText)
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
