let cachedWriterToken

/**
 * Reads the configured writer token from runtime environment.
 *
 * @returns {string} Trimmed writer token or an empty string when unset.
 */
const getConfiguredWriterToken = () => String(process.env.CMR_WRITER_TOKEN || '').trim()

/**
 * Returns the bearer token used for CMR ingest/writeback requests.
 *
 * @returns {Promise<string>} Configured CMR bearer token.
 * @throws {Error} If `CMR_WRITER_TOKEN` is empty or missing.
 */
export const getCmrWriterToken = async () => {
  if (cachedWriterToken) {
    return cachedWriterToken
  }

  const configuredToken = getConfiguredWriterToken()

  if (!configuredToken) {
    throw new Error('Missing CMR writer token configuration: set CMR_WRITER_TOKEN')
  }

  cachedWriterToken = configuredToken

  return cachedWriterToken
}

export default getCmrWriterToken
