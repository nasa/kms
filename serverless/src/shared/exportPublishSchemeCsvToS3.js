import { PutObjectCommand } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'
import { primePublishedConceptCacheFromCsv } from '@/shared/primePublishedConceptCacheFromCsv'

/**
 * Publisher-side export and cache-prime helper for the current published keyword set.
 *
 * This module is responsible for taking the live published KMS concepts and materializing them in
 * two places during publish:
 * 1. versioned CSV snapshots in the RDF backup S3 bucket
 * 2. Redis lookup entries for the current published keyword cache
 *
 * That pairing matters because the CSV archive gives us durable historical snapshots, while the
 * Redis priming step gives the application fast runtime lookups for “is this keyword currently
 * valid?” and “what is the current published path for this UUID?”.
 */
const s3 = getS3Client()

/**
 * Waits between per-scheme export operations so local/dev runs can reduce request bursts if needed.
 *
 * @param {number} ms - Delay duration in milliseconds.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * Exports every published concept scheme as a versioned CSV snapshot and primes the published
 * Redis cache from the same CSV content.
 *
 * The flow for each published scheme is:
 * 1. download the published concepts in CSV form
 * 2. prime the published Redis cache from that CSV
 * 3. upload the CSV to the environment-specific backup bucket under `{versionName}/{scheme}.csv`
 *
 * We process schemes serially so failures are isolated and optional delays can smooth out bursts
 * to dependent services during local or lower-environment runs.
 *
 * If any scheme fails its download, cache-prime, or upload step, the function throws after the
 * loop with a summary of failed schemes so the caller can treat the publish as incomplete.
 *
 * Resolves when every published scheme has been cached and uploaded successfully.
 *
 * The returned summary is used by the publisher to confirm the current published Redis lookup
 * cache is actually ready before keyword events are emitted to downstream consumers.
 *
 * @returns {Promise<{
 *   versionName: string,
 *   schemeCount: number,
 *   uploadedCount: number,
 *   cachedCount: number,
 *   cacheReady: boolean
 * }>} Export summary for the published cache-preparation step.
 * @throws {Error} If the published version cannot be determined or any scheme export fails.
 */
export const exportPublishSchemeCsvToS3 = async () => {
  const s3ExportDelayMs = parseInt(process.env.S3_EXPORT_DELAY_MS || '100', 10)
  const { env } = getApplicationConfig()
  const bucketName = `kms-rdf-backup-${env}`

  try {
    const { versionName } = await getVersionMetadata('published')
    if (!versionName) {
      throw new Error('Could not determine published version name.')
    }

    const schemes = await getConceptSchemeDetails({ version: 'published' })
    if (!schemes || schemes.length === 0) {
      logger.warn('No published concept schemes found to export.')

      return {
        versionName,
        schemeCount: 0,
        uploadedCount: 0,
        cachedCount: 0,
        cacheReady: true
      }
    }

    logger.info(
      `[publisher] Starting published CSV export version=${versionName} bucket=${bucketName} schemes=${schemes.length}`
    )

    const failedSchemes = []
    const cachePrimeReadinessFailures = []
    let uploadedCount = 0
    let cachedCount = 0

    await schemes.reduce((previousPromise, scheme, index) => previousPromise.then(async () => {
      const { notation } = scheme
      try {
        const csvData = await downloadConcepts({
          conceptScheme: notation,
          format: 'csv',
          version: 'published'
        })

        const publishedCachePrimeResult = await primePublishedConceptCacheFromCsv({
          csvContent: csvData,
          scheme: notation
        })

        if (!publishedCachePrimeResult.cacheReady) {
          throw new Error(
            `Published concept cache not ready for scheme=${notation} `
            + `reason=${publishedCachePrimeResult.skipReason || 'unknown'}`
          )
        }

        cachedCount += publishedCachePrimeResult.cachedCount

        const s3Key = `${versionName}/${notation}.csv`

        await s3.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: csvData,
          ContentType: 'text/csv'
        }))

        uploadedCount += 1

        if (s3ExportDelayMs > 0 && index < schemes.length - 1) {
          await delay(s3ExportDelayMs)
        }
      } catch (error) {
        logger.error(`Failed to process scheme ${notation}: ${error.message}`)
        failedSchemes.push({
          notation,
          error
        })

        if (String(error.message || '').includes('Published concept cache not ready')) {
          cachePrimeReadinessFailures.push(notation)
        }
      }
    }), Promise.resolve())

    if (failedSchemes.length > 0) {
      throw new Error(`Failed to export CSV for schemes: ${failedSchemes.map(({ notation }) => notation).join(', ')}`)
    }

    logger.info(
      `[publisher] Completed published CSV export version=${versionName} bucket=${bucketName} schemes=${schemes.length} uploaded=${uploadedCount} cached=${cachedCount} failed=${failedSchemes.length}`
    )

    return {
      versionName,
      schemeCount: schemes.length,
      uploadedCount,
      cachedCount,
      cacheReady: cachePrimeReadinessFailures.length === 0
    }
  } catch (error) {
    logger.error(`Error in exportPublishSchemeCsvToS3: ${error.message}`)
    throw error
  }
}

export default exportPublishSchemeCsvToS3
