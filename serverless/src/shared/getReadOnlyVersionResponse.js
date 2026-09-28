/**
 * Builds the response for attempts to modify a read-only keyword version.
 */
export const getReadOnlyVersionResponse = (headers) => ({
  statusCode: 403,
  headers,
  body: JSON.stringify({
    message: 'This keyword version is read-only. Make changes in the draft version and publish them to update production.'
  })
})
