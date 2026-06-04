/**
 * Shapes the cached response body used for short-name concept lookups.
 *
 * @param {Object} params The short-name lookup response input.
 * @param {string} params.uuid Concept UUID.
 * @param {string} params.fullPath Canonical full path for the concept.
 * @param {string} [params.longName] Optional long-name label.
 * @param {string} [params.providerUrl] Optional provider URL.
 * @param {Object} params.keywordObject Normalized keyword object for the concept.
 * @returns {Object} Response body stored in Redis for short-name lookups.
 */
export const createShortNameConceptResponseBody = ({
  uuid,
  fullPath,
  longName,
  providerUrl,
  keywordObject
}) => {
  const responseBody = {
    uuid,
    fullPath,
    keywordObject
  }

  if (longName) {
    responseBody.longName = longName
  }

  if (providerUrl) {
    responseBody.providerUrl = providerUrl
  }

  return responseBody
}
