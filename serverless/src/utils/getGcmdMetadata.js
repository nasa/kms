import getConceptScheme from './getConceptSchemeOfConcept'

/**
 * Generates GCMD (Global Change Master Directory) metadata based on provided parameters.
 *
 * @async
 * @function getGcmdMetadata
 * @param {Object} options - The options for generating metadata.
 * @param {string|null} [options.conceptIRI=null] - The IRI (Internationalized Resource Identifier) of the concept.
 * @param {number|null} [options.gcmdHits=null] - The number of GCMD hits.
 * @returns {Promise<Object>} A promise that resolves to an object containing the GCMD metadata.
 *
 * @example
 * const metadata = await getGcmdMetadata({
 *   conceptIRI: 'https://gcmd.earthdata.nasa.gov/kms/concept/1234',
 *   gcmdHits: 100
 * });
 */
const getGcmdMetadata = async ({
  conceptIRI = null, gcmdHits = null, pageNum = 1, pageSize = 2000
}) => {
  const baseMetadata = {}
  if (gcmdHits !== null) {
    baseMetadata['gcmd:hits'] = {
      _text: `${gcmdHits}`
    }

    baseMetadata['gcmd:page_num'] = {
      _text: `${pageNum}`
    }

    baseMetadata['gcmd:page_size'] = {
      _text: `${pageSize}`
    }
  }

  baseMetadata['gcmd:termsOfUse'] = {
    _text: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf'
  }

  baseMetadata['gcmd:keywordVersion'] = {
    _text: '20.5'
  }

  if (conceptIRI) {
    const conceptScheme = await getConceptScheme(conceptIRI)
    const schemeId = conceptScheme.split('/').pop()
    const iriIdentifier = conceptIRI.split('/').pop()

    baseMetadata['gcmd:schemeVersion'] = {
      _text: '2025-01-22 17:32:01'
    }

    baseMetadata['gcmd:viewer'] = {
      _text: `https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/${schemeId}/${iriIdentifier}`

    }
  } else {
    baseMetadata['gcmd:viewer'] = {
      _text: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all'
    }
  }

  return baseMetadata
}

export default getGcmdMetadata
