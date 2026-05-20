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

/**
 * Collection-scoped metadata-correction worker for KMS keyword events.
 *
 * This Lambda consumes the fanout requests published by the CMR keyword-events listener and does
 * the heavier correction work for one collection at a time. It fetches the current collection
 * UMM from CMR, validates supported keywords against the published Redis cache, resolves invalid
 * values through the historical and published keyword caches, hands actionable fixes to the
 * format-specific delegate, records audit rows, and finally performs the current ingest/writeback
 * step for the local smoke flow.
 *
 * In practice this is the core of the KMS-675 pipeline:
 * 1. fetch collection metadata
 * 2. find invalid keywords
 * 3. resolve replace/delete actions
 * 4. apply corrections through the delegate
 * 5. persist audit history
 * 6. hand corrected metadata to the ingest seam
 *
 * @param {{ Records?: Array<{ body?: string, messageId?: string }> }} event - SQS batch event.
 * @returns {Promise<{batchItemFailures: Array}>} Empty batch failures for acknowledged messages.
 */
export const metadataCorrectionService = async (event) => {
  const records = event?.Records || []

  // Process each collection-level correction request independently within the SQS batch.
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
      // Resolve each extracted broken keyword into the semantic replacement reference delegates
      // need, including optional long-name metadata when the historical/published caches expose it.
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
            oldLongName: keywordReference?.oldLongName,
            newLongName: keywordReference?.newLongName,
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

      // A fully clean validation pass means there is nothing for the correction flow to do.
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

      // We found invalid keywords, but none of them could be resolved into a replace/delete action.
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

      // Some keywords were resolvable and some were not, so continue with the actionable subset.
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

      // Log every extracted keyword failure so CloudWatch shows both actionable and unresolved cases.
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

        // Hand only fully-resolved corrections to the format-specific delegate. The delegate
        // contract carries canonical path data plus optional old/new long names for short-name
        // schemes that provide them in the caches.
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
            newKeywordPath: keywordValidationFailure.newKeywordPath,
            ...(keywordValidationFailure.oldLongName
              ? { oldLongName: keywordValidationFailure.oldLongName }
              : {}),
            ...(keywordValidationFailure.newLongName
              ? { newLongName: keywordValidationFailure.newLongName }
              : {})
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
          correctedMetadata: delegateResult.correctedMetadata
        })

        // A successful writeback means the correction was actually applied for this run.
        const auditStatus = ingestResult.ingested ? 'applied' : 'pending'

        // Surface writeback behavior separately because it controls whether later events
        // see corrected metadata or keep observing the original broken collection.
        if (ingestResult.updated) {
          logger.info(
            '[metadata-correction] Updated collection metadata '
            + `collectionConceptId=${collectionConceptId} `
            + `revisionId=${ingestResult.revisionId} `
            + `updated=${ingestResult.updated}`
          )
        } else if (ingestResult.writebackErrorMessage) {
          logger.error(
            '[metadata-correction] Failed to update collection metadata',
            new Error(ingestResult.writebackErrorMessage)
          )
        }

        try {
          // Persist one audit row per actionable correction so we can inspect what the service
          // decided to do even if downstream writeback behavior changes later. The audit log
          // intentionally stores the canonical UUID/path fields only; optional delegate-only
          // metadata such as long names is not written there yet.
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

        // Log the ingest seam last so the local smoke flow can distinguish delegate, audit,
        // and writeback milestones in order.
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
      // Re-throw so the record fails visibly and normal Lambda/SQS retry behavior can take over.
      logger.error('[metadata-correction] Failed to process metadata correction request', error)
      throw error
    }
  }))

  return {
    batchItemFailures: []
  }
}

export default metadataCorrectionService
