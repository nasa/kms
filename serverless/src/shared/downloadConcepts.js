import { getConcepts } from '@/getConcepts/handler'
import { logger } from '@/shared/logger'

export const downloadConcepts = async ({ conceptScheme, format = 'csv', version = 'published' }) => {
  logger.debug(`Downloading ${format.toUpperCase()} for concept scheme: ${conceptScheme}, version: ${version}`)

  try {
    // Create an event object similar to what API Gateway would pass to the Lambda function
    const event = {
      pathParameters: { conceptScheme },
      queryStringParameters: {
        format,
        version
      },
      resource: '/concepts/concept_scheme/{conceptScheme}'
    }

    // Call the handler directly
    const result = await getConcepts(event)

    if (result.statusCode !== 200) {
      let errorMessage = `Failed to download ${format.toUpperCase()}. Status: ${result.statusCode}`
      let isSchemeNotFound = false

      const errorBody = JSON.parse(result.body)
      if (errorBody.error) {
        errorMessage += ` - ${errorBody.error}`
        // Check if the error indicates the scheme doesn't exist
        if (result.statusCode === 404 && errorBody.error.includes('Concept scheme not found')) {
          isSchemeNotFound = true
        }
      }

      const error = new Error(errorMessage)
      error.statusCode = result.statusCode
      error.isSchemeNotFound = isSchemeNotFound
      throw error
    }

    // Parse the result based on the format
    let content
    if (format.toLowerCase() === 'json') {
      content = JSON.parse(result.body)
    } else {
      content = result.body
    }

    logger.debug(`Received ${format.toUpperCase()} content`)

    return content
  } catch (error) {
    logger.error(`Error downloading ${format.toUpperCase()} for ${conceptScheme}:`, error.message)
    throw error
  }
}
