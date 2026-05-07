const isLocalMode = () => (
  String(process.env.USE_LOCALSTACK || '').toLowerCase() === 'true'
  || String(process.env.useLocalstack || '').toLowerCase() === 'true'
)
const isEnabled = () => (
  isLocalMode()
  && String(process.env.MOCK_CMR_WRITEBACK_ENABLED || '').toLowerCase() === 'true'
)

/**
 * Local-only helper that writes corrected metadata back into the in-memory mock CMR server.
 *
 * This is intentionally disabled unless both USE_LOCALSTACK/useLocalstack=true and
 * MOCK_CMR_WRITEBACK_ENABLED=true so production-like deployments never attempt to call
 * mock-only routes.
 */
export const persistMockCmrCollectionMetadata = async ({
  collectionConceptId,
  providerId,
  nativeId,
  nativeFormat,
  correctedMetadata,
  validation
}) => {
  if (!isEnabled()) {
    return {
      updated: false,
      enabled: false
    }
  }

  const baseUrl = process.env.MOCK_CMR_BASE_URL || process.env.CMR_BASE_URL

  if (!baseUrl) {
    throw new Error('Missing MOCK_CMR_BASE_URL/CMR_BASE_URL for mock metadata writeback')
  }

  if (!collectionConceptId) {
    throw new Error('Missing collectionConceptId for mock metadata writeback')
  }

  if (!correctedMetadata) {
    return {
      updated: false,
      enabled: true
    }
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/local/collections/${encodeURIComponent(collectionConceptId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        providerId,
        nativeId,
        nativeFormat,
        umm: correctedMetadata,
        validation
      })
    }
  )

  if (!response.ok) {
    const responseText = await response.text()

    throw new Error(`Mock metadata writeback failed: ${response.status} ${responseText}`)
  }

  return response.json()
}

export default persistMockCmrCollectionMetadata
