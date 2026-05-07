import { detectNativeMetadataFormat } from '@/shared/detectNativeMetadataFormat'
import { extractKeywordValidationFailures } from '@/shared/extractKeywordValidationFailures'
import { getCmrCollectionUmmDetails } from '@/shared/getCmrCollectionUmmDetails'
import { ingestCorrectedMetadataStub } from '@/shared/ingestCorrectedMetadataStub'
import { invokeMetadataCorrectionDelegate } from '@/shared/invokeMetadataCorrectionDelegate'
import { logger } from '@/shared/logger'
import { persistMetadataCorrectionAuditLog } from '@/shared/persistMetadataCorrectionAuditLog'
import { resolveOldKeywordConceptUuid } from '@/shared/resolveOldKeywordConceptUuid'
import { validateCmrCollectionUmm } from '@/shared/validateCmrCollectionUmm'

// Keep validation paths grep-friendly in logs without dumping full JSON payloads.
const formatValidationPath = (path = []) => path.join('.')

const buildValidationResultForMockWriteback = (resolvedKeywordValidationFailures) => {
  const unresolvedValidationErrors = resolvedKeywordValidationFailures
    .filter(({
      keywordConceptUuid,
      oldKeywordPath,
      newKeywordPath,
      keywordAction
    }) => (
      keywordAction === 'delete'
        ? !(keywordConceptUuid && oldKeywordPath)
        : !(keywordConceptUuid && oldKeywordPath && newKeywordPath)
    ))
    .map(({ path, errors = [] }) => ({
      path,
      errors
    }))

  if (unresolvedValidationErrors.length === 0) {
    return {
      status: 200,
      errors: [],
      warnings: []
    }
  }

  return {
    status: 400,
    errors: unresolvedValidationErrors,
    warnings: []
  }
}

/**
 * Metadata correction service that consumes metadata correction requests from SQS.
 *
 * This stage of KMS-675 fetches a collection's UMM-C from CMR, validates it through the
 * CMR validate-collection endpoint, and extracts keyword-related validation failures for the
 * later resolver/delegate flow.
 *
 * The current KMS-675 implementation already wires keyword-resolution stubs, native-format
 * detection, delegate routing, and ingest handoff. Follow-on work should replace those stubs
 * with real KMS lookup, real format-specific metadata mutation, and real CMR write-back.
 *
 * @param {{ Records?: Array<{ body?: string, messageId?: string }> }} event - SQS batch event.
 * @returns {Promise<{batchItemFailures: Array}>} Empty batch failures for acknowledged messages.
 */
export const metadataCorrectionService = async (event) => {
  const records = event?.Records || []

  await Promise.all(records.map(async (record) => {
    try {
      // Parse the queue message into the collection-level correction request we will process.
      const {
        body,
        messageId
      } = record
      const metadataCorrectionRequest = JSON.parse(body || '{}')
      const {
        collectionConceptId,
        source,
        keywordEvent = {}
      } = metadataCorrectionRequest
      const {
        eventType,
        scheme,
        uuid
      } = keywordEvent

      logger.info(
        '[metadata-correction] Received metadata correction request '
        + `collectionConceptId=${collectionConceptId || 'n/a'} `
        + `messageId=${messageId || 'n/a'} `
        + `source=${source || 'n/a'} `
        + `eventType=${eventType || 'n/a'} `
        + `scheme=${scheme || 'n/a'} `
        + `uuid=${uuid || 'n/a'}`
      )

      if (!collectionConceptId) {
        logger.info(
          '[metadata-correction] Skipping request without collection concept id '
          + `messageId=${messageId || 'n/a'}`
        )

        return
      }

      // Fetch the collection's current UMM-C plus the CMR identifiers needed for validation.
      const {
        nativeId,
        providerId,
        format,
        umm
      } = await getCmrCollectionUmmDetails({
        collectionConceptId
      })
      const nativeFormat = detectNativeMetadataFormat({
        format
      })
      const validationResult = await validateCmrCollectionUmm({
        providerId,
        nativeId,
        umm
      })
      // Filter the validation response down to keyword failures we can extract from UMM-C.
      const keywordValidationFailures = extractKeywordValidationFailures({
        umm,
        validationErrors: validationResult.errors
      })
      // Resolve each extracted broken keyword into the semantic replacement reference that delegates need.
      const resolvedKeywordValidationFailures = await Promise.all(
        keywordValidationFailures.map(async (keywordValidationFailure) => {
          const {
            scheme: failureScheme,
            oldKeyword
          } = keywordValidationFailure
          const keywordReference = await resolveOldKeywordConceptUuid({
            scheme: failureScheme,
            oldKeyword,
            keywordEvent
          })

          return {
            ...keywordValidationFailure,
            keywordConceptUuid: keywordReference?.keywordConceptUuid,
            oldKeywordPath: keywordReference?.oldKeywordPath,
            newKeywordPath: keywordReference?.newKeywordPath,
            keywordAction: keywordReference?.action
          }
        })
      )
      // Only pass failures downstream once we have a complete keyword replacement reference.
      const actionableKeywordValidationFailures = resolvedKeywordValidationFailures.filter(
        ({
          keywordConceptUuid,
          oldKeywordPath,
          newKeywordPath,
          keywordAction
        }) => (
          keywordAction === 'delete'
            ? Boolean(keywordConceptUuid && oldKeywordPath)
            : Boolean(keywordConceptUuid && oldKeywordPath && newKeywordPath)
        )
      )
      // Keep track of the failures we found but could not yet turn into a replacement reference.
      const unresolvedKeywordValidationFailureCount = (
        resolvedKeywordValidationFailures.length - actionableKeywordValidationFailures.length
      )

      if (resolvedKeywordValidationFailures.length === 0) {
        logger.info(
          '[metadata-correction] No keyword validation failures extracted '
          + `collectionConceptId=${collectionConceptId} `
          + `providerId=${providerId} `
          + `nativeId=${nativeId} `
          + `validationStatus=${validationResult.status} `
          + `validationErrorCount=${validationResult.errors.length}`
        )
      }

      if (
        resolvedKeywordValidationFailures.length > 0
        && actionableKeywordValidationFailures.length === 0
      ) {
        logger.info(
          '[metadata-correction] No resolvable keyword corrections found '
          + `collectionConceptId=${collectionConceptId} `
          + `providerId=${providerId} `
          + `nativeId=${nativeId} `
          + `keywordValidationFailureCount=${resolvedKeywordValidationFailures.length}`
        )
      }

      if (
        actionableKeywordValidationFailures.length > 0
        && unresolvedKeywordValidationFailureCount > 0
      ) {
        logger.info(
          '[metadata-correction] Proceeding with partial keyword corrections '
          + `collectionConceptId=${collectionConceptId} `
          + `providerId=${providerId} `
          + `nativeId=${nativeId} `
          + `actionableKeywordValidationFailureCount=${actionableKeywordValidationFailures.length} `
          + `unresolvedKeywordValidationFailureCount=${unresolvedKeywordValidationFailureCount}`
        )
      }

      resolvedKeywordValidationFailures.forEach((keywordValidationFailure) => {
        const {
          scheme: failureScheme,
          path,
          oldKeyword,
          errors
        } = keywordValidationFailure

        logger.info(
          '[metadata-correction] Extracted keyword validation failure '
          + `collectionConceptId=${collectionConceptId} `
          + `providerId=${providerId} `
          + `nativeId=${nativeId} `
          + `scheme=${failureScheme} `
          + `path=${formatValidationPath(path)} `
          + `oldKeyword=${oldKeyword || 'n/a'} `
          + `message=${errors?.[0] || 'n/a'}`
        )
      })

      if (actionableKeywordValidationFailures.length > 0) {
        actionableKeywordValidationFailures.forEach((keywordValidationFailure) => {
          logger.info(
            '[metadata-correction] Resolved keyword correction '
            + `collectionConceptId=${collectionConceptId} `
            + `scheme=${keywordValidationFailure.scheme} `
            + `action=${keywordValidationFailure.keywordAction || 'replace'} `
            + `keywordConceptUuid=${keywordValidationFailure.keywordConceptUuid} `
            + `oldKeywordPath=${keywordValidationFailure.oldKeywordPath} `
            + `newKeywordPath=${keywordValidationFailure.newKeywordPath || 'n/a'}`
          )
        })

        // Hand only fully-resolved corrections to the format-specific delegate.
        const delegateResult = await invokeMetadataCorrectionDelegate({
          nativeFormat,
          collectionConceptId,
          providerId,
          nativeId,
          metadataPayload: nativeFormat === 'UMM' ? umm : undefined,
          corrections: actionableKeywordValidationFailures.map((keywordValidationFailure) => ({
            scheme: keywordValidationFailure.scheme,
            action: keywordValidationFailure.keywordAction || 'replace',
            ummPath: keywordValidationFailure.path,
            keywordConceptUuid: keywordValidationFailure.keywordConceptUuid,
            oldKeywordPath: keywordValidationFailure.oldKeywordPath,
            newKeywordPath: keywordValidationFailure.newKeywordPath
          }))
        })

        logger.info(
          '[metadata-correction] Invoked metadata correction delegate '
          + `collectionConceptId=${collectionConceptId} `
          + `nativeFormat=${delegateResult.nativeFormat} `
          + `delegateName=${delegateResult.delegateName} `
          + `correctionCount=${delegateResult.correctionCount} `
          + `stubbed=${delegateResult.stubbed}`
        )

        // Keep the ingest call in place so the end-to-end flow is wired even while ingest is stubbed.
        const ingestResult = await ingestCorrectedMetadataStub({
          collectionConceptId,
          providerId,
          nativeId,
          nativeFormat: delegateResult.nativeFormat,
          correctionCount: delegateResult.correctionCount,
          correctedMetadata: delegateResult.correctedMetadata,
          validation: buildValidationResultForMockWriteback(resolvedKeywordValidationFailures)
        })

        const auditStatus = ingestResult.ingested ? 'applied' : 'pending'

        if (ingestResult.updated) {
          logger.info(
            '[metadata-correction] Updated mock CMR metadata '
            + `collectionConceptId=${collectionConceptId} `
            + `revisionId=${ingestResult.revisionId} `
            + `updated=${ingestResult.updated}`
          )
        } else if (ingestResult.writebackErrorMessage) {
          logger.error(
            '[metadata-correction] Failed to update mock CMR metadata',
            new Error(ingestResult.writebackErrorMessage)
          )
        }

        try {
          const auditResult = await persistMetadataCorrectionAuditLog({
            collectionConceptId,
            keywordEvent,
            nativeFormat: delegateResult.nativeFormat,
            delegateName: delegateResult.delegateName,
            corrections: actionableKeywordValidationFailures.map((keywordValidationFailure) => ({
              scheme: keywordValidationFailure.scheme,
              keywordConceptUuid: keywordValidationFailure.keywordConceptUuid,
              oldKeywordPath: keywordValidationFailure.oldKeywordPath,
              newKeywordPath: keywordValidationFailure.newKeywordPath
            })),
            status: auditStatus
          })

          logger.info(
            '[metadata-correction] Persisted metadata correction audit log '
            + `collectionConceptId=${collectionConceptId} `
            + `insertedCount=${auditResult.insertedCount} `
            + `publishedVersionName=${auditResult.publishedVersionName} `
            + `status=${auditResult.status}`
          )
        } catch (error) {
          logger.error('[metadata-correction] Failed to persist metadata correction audit log', error)
        }

        logger.info(
          '[metadata-correction] Invoked metadata ingest stub '
          + `collectionConceptId=${collectionConceptId} `
          + `nativeFormat=${ingestResult.nativeFormat} `
          + `correctionCount=${ingestResult.correctionCount} `
          + `ingested=${ingestResult.ingested} `
          + `stubbed=${ingestResult.stubbed}`
        )
      }
    } catch (error) {
      logger.error('[metadata-correction] Failed to process metadata correction request', error)
      throw error
    }
  }))

  return {
    batchItemFailures: []
  }
}

export default metadataCorrectionService
