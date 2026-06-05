/**
 * Redis-backed published keyword validation for collection UMM-C.
 *
 * This module replaces the old dependency on CMR's keyword validation timing for the
 * metadata-correction flow. Instead of asking CMR whether a collection's keywords are valid,
 * it inspects the supported keyword fields directly in UMM-C and checks them against the current
 * published keyword cache in Redis.
 *
 * We need to do this because CMR's own keyword validation view can lag behind a fresh KMS
 * publish. In that window, a keyword event may already tell us a concept changed or was deleted,
 * while CMR validation can still report the old metadata as valid. Using the published Redis
 * cache lets metadata correction validate against the current KMS state immediately.
 *
 * The result is intentionally shaped like the older validation response contract
 * (`{ status, errors, warnings, responseBody }`) so downstream correction logic can keep working
 * without needing to care whether validation came from CMR or from the published cache.
 */
import { extractKeywordValue } from './extractKeywordValue'
import { logger } from './logger'
import { getPublishedConceptByKeyword } from './redis-path-store/getPublishedConceptByKeyword'
import { getRedisClient } from './redisCacheStore'

const VALIDATION_MESSAGES = {
  sciencekeywords: 'Science keyword was not a valid keyword combination.',
  platforms: 'Platform short name was not a valid keyword combination.',
  instruments: 'Instrument short name was not a valid keyword combination.',
  locations: 'Location keyword was not a valid keyword combination.',
  chronounits: 'Chronostratigraphic unit was not a valid keyword combination.',
  projects: 'Project short name was not a valid keyword combination.',
  providers: 'Data center short name was not a valid keyword.',
  idnnode: 'Directory name short name was not a valid keyword.',
  isotopiccategory: 'ISO Topic Category was not a valid keyword.',
  temporalresolutionrange: 'Temporal resolution was not a valid keyword.',
  horizontalresolutionrange: 'Horizontal resolution was not a valid keyword range.',
  verticalresolutionrange: 'Vertical resolution was not a valid keyword range.',
  productlevelid: 'ProcessingLevel Id was not a valid keyword.',
  dataformat: 'Format was not a valid keyword.',
  granuledataformat: 'Format was not a valid keyword.',
  rucontenttype: 'Related URL Content Type was not a valid set together.'
}

// Builds the CMR-like validation error shape expected by downstream correction logic.
const createValidationError = ({
  scheme,
  path
}) => ({
  path,
  errors: [VALIDATION_MESSAGES[scheme]]
})

// Appends one supported keyword candidate to the validation work list.
const pushKeywordCandidate = ({
  candidates,
  scheme,
  path
}) => {
  candidates.push({
    scheme,
    path
  })
}

// Walks the supported UMM-C keyword fields and records the validation paths we should check.
const extractKeywordCandidatesFromUmm = (umm) => {
  const candidates = [];
  (umm.ScienceKeywords || []).forEach((keyword, index) => {
    if (keyword) {
      pushKeywordCandidate({
        candidates,
        scheme: 'sciencekeywords',
        path: ['ScienceKeywords', index]
      })
    }
  });

  (umm.Platforms || []).forEach((platform, platformIndex) => {
    if (!platform) {
      return
    }

    pushKeywordCandidate({
      candidates,
      scheme: 'platforms',
      path: ['Platforms', platformIndex]
    });

    (platform.Instruments || []).forEach((instrument, instrumentIndex) => {
      if (instrument) {
        pushKeywordCandidate({
          candidates,
          scheme: 'instruments',
          path: ['Platforms', platformIndex, 'Instruments', instrumentIndex]
        })
      }
    })
  });

  (umm.LocationKeywords || []).forEach((keyword, index) => {
    if (keyword) {
      pushKeywordCandidate({
        candidates,
        scheme: 'locations',
        path: ['LocationKeywords', index]
      })
    }
  });

  (umm.PaleoTemporalCoverages || []).forEach((coverage, coverageIndex) => {
    (coverage?.ChronostratigraphicUnits || []).forEach((unit, unitIndex) => {
      if (unit) {
        pushKeywordCandidate({
          candidates,
          scheme: 'chronounits',
          path: ['PaleoTemporalCoverages', coverageIndex, 'ChronostratigraphicUnits', unitIndex]
        })
      }
    })
  });

  (umm.Projects || []).forEach((project, index) => {
    if (project) {
      pushKeywordCandidate({
        candidates,
        scheme: 'projects',
        path: ['Projects', index]
      })
    }
  });

  (umm.DataCenters || []).forEach((dataCenter, index) => {
    if (dataCenter) {
      pushKeywordCandidate({
        candidates,
        scheme: 'providers',
        path: ['DataCenters', index]
      })
    }
  });

  (umm.DirectoryNames || []).forEach((directoryName, index) => {
    if (directoryName) {
      pushKeywordCandidate({
        candidates,
        scheme: 'idnnode',
        path: ['DirectoryNames', index]
      })
    }
  });

  ((umm.ISOTopicCategories || umm.IsoTopicCategories) || []).forEach((category, index) => {
    if (category) {
      pushKeywordCandidate({
        candidates,
        scheme: 'isotopiccategory',
        path: ['IsoTopicCategories', index]
      })
    }
  });

  (umm.TemporalExtents || []).forEach((temporalExtent, index) => {
    if (temporalExtent?.TemporalResolution) {
      pushKeywordCandidate({
        candidates,
        scheme: 'temporalresolutionrange',
        path: ['TemporalExtents', index, 'TemporalResolution']
      })
    }
  })

  if (umm.SpatialInformation?.ResolutionAndCoordinateSystem?.HorizontalDataResolution) {
    pushKeywordCandidate({
      candidates,
      scheme: 'horizontalresolutionrange',
      path: ['SpatialInformation', 'ResolutionAndCoordinateSystem', 'HorizontalDataResolution']
    })
  }

  (umm.SpatialExtent?.VerticalSpatialDomains || []).forEach((domain, index) => {
    if (domain) {
      pushKeywordCandidate({
        candidates,
        scheme: 'verticalresolutionrange',
        path: ['SpatialExtent', 'VerticalSpatialDomains', index]
      })
    }
  })

  if (umm.ProcessingLevel?.Id) {
    pushKeywordCandidate({
      candidates,
      scheme: 'productlevelid',
      path: ['ProcessingLevel', 'Id']
    })
  }

  (umm.ArchiveAndDistributionInformation?.FileArchiveInformation || []).forEach((item, index) => {
    if (item) {
      pushKeywordCandidate({
        candidates,
        scheme: 'dataformat',
        path: ['ArchiveAndDistributionInformation', 'FileArchiveInformation', index]
      })
    }
  });

  (
    umm.ArchiveAndDistributionInformation?.FileDistributionInformation
    || []
  ).forEach((item, index) => {
    if (item) {
      pushKeywordCandidate({
        candidates,
        scheme: 'dataformat',
        path: ['ArchiveAndDistributionInformation', 'FileDistributionInformation', index]
      })
    }
  });

  (umm.RelatedUrls || []).forEach((relatedUrl, index) => {
    if (!relatedUrl) {
      return
    }

    if (relatedUrl.URLContentType || relatedUrl.Type || relatedUrl.Subtype) {
      pushKeywordCandidate({
        candidates,
        scheme: 'rucontenttype',
        path: ['RelatedUrls', index]
      })
    }

    if (relatedUrl.GetData?.Format) {
      pushKeywordCandidate({
        candidates,
        scheme: 'granuledataformat',
        path: ['RelatedUrls', index, 'GetData', 'Format']
      })
    }
  })

  return candidates
}

// Validates one extracted keyword candidate against the published Redis cache.
const validatePublishedKeywordCandidate = async ({
  scheme,
  path,
  umm
}) => {
  const normalizedScheme = String(scheme).toLowerCase()
  const keywordValue = extractKeywordValue({
    scheme,
    path,
    umm
  })

  const publishedConcept = await getPublishedConceptByKeyword({
    scheme: normalizedScheme,
    keywordValue
  })

  return publishedConcept
    ? undefined
    : createValidationError({
      scheme: normalizedScheme,
      path
    })
}

// Validates the collection's supported keywords against the published cache and returns a CMR-like result.
/**
 * Validates a collection's UMM-C against the published KMS keyword cache.
 *
 * The validation flow is:
 * 1. extract the supported keyword candidates from the UMM-C payload
 * 2. convert each candidate into the lookup form expected by the published Redis cache
 * 3. check that lookup against the appropriate published cache namespace
 * 4. emit a CMR-like validation error whenever the published lookup is missing
 *
 * We intentionally keep the return shape close to the older validation helper so the
 * metadata-correction flow can continue to consume `{ status, errors, warnings, responseBody }`
 * without needing to know whether validation came from CMR or from Redis.
 *
 * @param {object} params - Validation parameters.
 * @param {string} [params.providerId] - Collection provider id, used only for log context.
 * @param {string} [params.nativeId] - Collection native id, used only for log context.
 * @param {Record<string, unknown>} params.umm - Collection UMM-C payload.
 * @returns {Promise<{status: number, errors: Array, warnings: Array, responseBody: Record<string, unknown>}>}
 * Validation results shaped like the previous response contract.
 * @throws {Error} If the UMM payload is missing or the published keyword cache is unavailable.
 */
export const validateCmrCollectionUmm = async ({
  providerId,
  nativeId,
  umm
}) => {
  if (!umm) {
    throw new Error('Missing UMM-C payload for published keyword cache validation')
  }

  // The validator depends on the published Redis cache being available in this process.
  const redisClient = await getRedisClient()

  if (!redisClient) {
    throw new Error('Published keyword cache is unavailable for metadata correction validation')
  }

  // Enumerate only the supported keyword families we know how to validate today.
  const keywordCandidates = extractKeywordCandidatesFromUmm(umm)
  // Validate every candidate independently so one collection can surface multiple invalid keywords.
  const validationErrors = (await Promise.all(
    keywordCandidates.map(async (keywordCandidate) => validatePublishedKeywordCandidate({
      ...keywordCandidate,
      umm
    }))
  )).filter(Boolean)

  // Preserve the familiar validation response shape expected by downstream correction logic.
  const validationResult = {
    status: validationErrors.length > 0 ? 400 : 200,
    errors: validationErrors,
    warnings: [],
    responseBody: validationErrors.length > 0
      ? {
        errors: validationErrors,
        warnings: []
      }
      : {
        warnings: []
      }
  }

  // Keep the result summary explicit in logs so correction runs can quickly tell whether the
  // collection is clean or how many invalid keywords were found.
  logger.info(
    '[metadata-correction] Validated collection UMM through published keyword cache '
    + `providerId=${providerId || 'n/a'} `
    + `nativeId=${nativeId || 'n/a'} `
    + `status=${validationResult.status} `
    + `errorCount=${validationResult.errors.length} `
    + `warningCount=${validationResult.warnings.length}`
  )

  return validationResult
}

export default validateCmrCollectionUmm
