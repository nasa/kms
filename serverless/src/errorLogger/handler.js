import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Logs an error reported by a client.
 *
 * This function receives error details from a client application, logs them to the console,
 * and returns a success response. It's designed to be used as an error reporting endpoint
 * for client-side applications.
 *
 * @async
 * @function errorLogger
 * @param {Object} event - The Lambda event object containing details about the HTTP request.
 * @param {string} event.body - A JSON string containing error details.
 * @param {string} event.body.message - The error message.
 * @param {string|Object} event.body.stack - The error stack trace.
 * @param {string} event.body.location - The location where the error occurred (e.g., URL, component name).
 * @param {string} event.body.action - The action being performed when the error occurred.
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode and headers.
 *
 * @example
 * // Lambda event object
 * const event = {
 *   body: JSON.stringify({
 *     message: 'Unexpected error occurred',
 *     stack: 'Error: Unexpected error occurred\n    at SomeFunction (app.js:123)',
 *     location: 'https://example.com/page',
 *     action: 'fetchData'
 *   })
 * };
 *
 * const result = await errorLogger(event);
 * console.log(result);
 * // Output:
 * // {
 * //   statusCode: 200,
 * //   headers: { ... }
 * // }
 *
 * // Console output:
 * // Error reported Action: fetchData - Message: Unexpected error occurred - Location: https://example.com/page - Stack: "Error: Unexpected error occurred\n    at SomeFunction (app.js:123)"
 */
export const errorLogger = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body } = event
  const {
    message,
    stack,
    location,
    action
  } = JSON.parse(body)

  console.error('Error reported', `Action: ${action} - Message: ${message} - Location: ${location} - Stack: ${JSON.stringify(stack)}`)

  return {
    statusCode: 200,
    headers: defaultResponseHeaders
  }
}

export default errorLogger
