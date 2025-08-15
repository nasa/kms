import { getConceptSchemeOfConcept } from '@/shared/getConceptSchemeOfConcept'
import { getVersionMetadata } from '@/shared/getVersionMetadata'

/**
 * Generates GCMD (Global Change Master Directory) metadata based on provided parameters.
 *
 * This function creates metadata for a specific concept or a set of concepts, including
 * version information, pagination details, and relevant URLs.
 *
 * @async
 * @function getGcmdMetadata
 * @param {Object} options - The options for generating metadata.
 * @param {string|null} [options.conceptIRI=null] - The IRI (Internationalized Resource Identifier) of the concept.
 * @param {number|null} [options.gcmdHits=null] - The number of GCMD hits.
 * @param {number} [options.pageNum=1] - The current page number for pagination.
 * @param {number} [options.pageSize=2000] - The number of items per page for pagination.
 * @param {string} options.version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Object>} A promise that resolves to an object containing the GCMD metadata.
 *
 * @example
 * // Generate metadata for a specific concept in the published version
 * const metadata = await getGcmdMetadata({
 *   conceptIRI: 'https://gcmd.earthdata.nasa.gov/kms/concept/1234',
 *   gcmdHits: 100,
 *   pageNum: 1,
 *   pageSize: 50,
 *   version: 'published'
 * });
 *
 * @example
 * // Generate metadata for all concepts in the draft version
 * const metadata = await getGcmdMetadata({
 *   gcmdHits: 1000,
 *   pageNum: 2,
 *   pageSize: 100,
 *   version: 'draft'
 * });
 *
 * @throws {Error} If there's an error fetching version metadata or concept scheme information.
 *
 * @see Related functions:
 * {@link getVersionMetadata}
 * {@link getConceptSchemeOfConcept}
 */
export const getGcmdMetadata = async ({
  conceptIRI = null, gcmdHits = null, pageNum = 1, pageSize = 2000, version
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

  const versionInfo = await getVersionMetadata(version)

  baseMetadata['gcmd:keywordVersion'] = {
    _text: versionInfo?.versionName || 'n/a'
  }

  if (conceptIRI) {
    const conceptScheme = await getConceptSchemeOfConcept(conceptIRI, version)
    const schemeId = conceptScheme.split('/').pop()
    const iriIdentifier = conceptIRI.split('/').pop()

    baseMetadata['gcmd:schemeVersion'] = {
      _text: versionInfo?.created || 'n/a'
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
