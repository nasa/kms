import { XMLParser } from 'fast-xml-parser'

import getConceptSchemes from '@/getConceptSchemes/handler'
import { getSkosConcept } from '@/shared/getSkosConcept'

// Helper function to retrieve parsed information in concept_schemes xml
function findMatchingLongName(schemeShortName, parsedData) {
  const schemes = parsedData.schemes.scheme

  const matchingScheme = schemes.find(
    (scheme) => scheme['@name'] === schemeShortName
  )

  return matchingScheme['@longName']
}

// Helper function to determine if there are multiple altLabels and assist in translating the different types
function processAltLabels(altLabels) {
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

    return processedLabel
  })
}

const toLegacyJSON = async (conceptIRI, skosConcept) => {
  try {
    // Extract the UUID from the @rdf:about field
    const uuid = skosConcept['@rdf:about']

    // Creating variables for calls to fetchMatchingSchemes
    const conceptSchemes = await getConceptSchemes()
    const xmlConceptSchemes = conceptSchemes.body

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@'
    })

    const parsedConceptSchemes = parser.parse(xmlConceptSchemes)

    // Extract scheme information
    const schemeResource = skosConcept['skos:inScheme']['@rdf:resource']
    const schemeShortName = schemeResource.split('/').pop()
    const schemeLongName = findMatchingLongName(schemeShortName, parsedConceptSchemes)

    // Extract additional data for broader
    const baseURI = conceptIRI.substring(0, conceptIRI.lastIndexOf('/') + 1)
    let broaderSkosConcept
    let broaderConceptIRI

    if (skosConcept['skos:broader']) {
      broaderConceptIRI = baseURI + skosConcept['skos:broader']['@rdf:resource']
      broaderSkosConcept = await getSkosConcept({ conceptIRI: broaderConceptIRI })
    }

    // Transform the data
    const transformedData = {
      termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
      keywordVersion: '20.6',
      schemeVersion: '2025-01-31 11:22:12', // Corrolates with the change of keywordVersion
      viewer: `https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/${schemeShortName}/${uuid}`,
      lastModifiedDate: skosConcept['dcterms:modified'],
      uuid,
      // eslint-disable-next-line no-underscore-dangle
      prefLabel: skosConcept['skos:prefLabel']._text,
      isLeaf: !skosConcept['skos:narrower'],
      scheme: {
        shortName: schemeShortName,
        longName: schemeLongName
      },
      broader: skosConcept['skos:broader'] ? [{
        uuid: broaderSkosConcept['@rdf:about'],
        // eslint-disable-next-line no-underscore-dangle
        prefLabel: broaderSkosConcept['skos:prefLabel']._text,
        isLeaf: false, // CHECK WITH TEAM. WHY FALSE?
        scheme: {
          shortName: schemeShortName,
          longName: schemeLongName
        }
      }] : [],
      narrower: await Promise.all((skosConcept['skos:narrower'] || []).map(async (narrow) => {
        // Extracting addition information for each narrower in array
        const narrowerConceptIRI = baseURI + narrow['@rdf:resource']
        const narrowerSkosConcept = await getSkosConcept({ conceptIRI: narrowerConceptIRI })

        return {
          uuid: narrowerSkosConcept['@rdf:about'],
          // eslint-disable-next-line no-underscore-dangle
          prefLabel: narrowerSkosConcept['skos:prefLabel']._text,
          isLeaf: !narrowerSkosConcept['skos:narrower'],
          scheme: {
            shortName: schemeShortName,
            longName: schemeLongName
          }
        }
      })),
      related: await Promise.all((skosConcept['skos:related'] || []).map(async (relation) => {
        // Extracting addition information for each narrower in array
        const relatedConceptIRI = baseURI + relation['@rdf:resource']
        const relatedSkosConcept = await getSkosConcept({ conceptIRI: relatedConceptIRI })

        return {
          uuid: relatedSkosConcept['@rdf:about'],
          // eslint-disable-next-line no-underscore-dangle
          prefLabel: relatedSkosConcept['skos:prefLabel']._text,
          isLeaf: !relatedSkosConcept['skos:narrower'],
          scheme: {
            shortName: schemeShortName,
            longName: schemeLongName
          },
          type: relatedSkosConcept['gcmd:type'].replace(/([A-Z])/g, '_$1').toLowerCase()
        }
      })),
      definitions: skosConcept['skos:definition'] ? [{
        // eslint-disable-next-line no-underscore-dangle
        text: skosConcept['skos:definition']._text,
        reference: skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
          ? skosConcept['gcmd:reference']['@gcmd:text']
          : ''
      }] : [],
      altLabels: processAltLabels(skosConcept['gcmd:altLabel']),
      resources: skosConcept['gcmd:resource'] ? [{
        type: skosConcept['gcmd:resource']['@gcmd:type'],
        url: skosConcept['gcmd:resource']['@gcmd:url']
      }] : []
    }

    return transformedData
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}

export default toLegacyJSON
