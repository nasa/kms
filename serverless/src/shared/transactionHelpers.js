import { sparqlRequest } from './sparqlRequest'

/**
 * Starts a new SPARQL transaction.
 *
 * @async
 * @function startTransaction
 * @returns {Promise<string>} A promise that resolves to the transaction URL.
 * @throws {Error} If there's an error starting the transaction.
 *
 * @example
 * try {
 *   const transactionUrl = await startTransaction();
 *   console.log('Transaction started:', transactionUrl);
 * } catch (error) {
 *   console.error('Error starting transaction:', error);
 * }
 */
export const startTransaction = async () => {
  const response = await sparqlRequest({
    path: '/transactions',
    method: 'POST'
  })

  return response.headers.get('Location')
}

/**
 * Commits any SPARQL updates to this transaction.
 *
 * @async
 * @function commitTransaction
 * @param {string} transactionUrl - The URL of the transaction to commit.
 * @throws {Error} If there's an error committing the transaction.
 *
 * @example
 * try {
 *   await commitTransaction('http://example.com/sparql/transaction/123');
 *   console.log('Transaction committed successfully');
 * } catch (error) {
 *   console.error('Error committing transaction:', error);
 * }
 */
export const commitTransaction = async (transactionUrl) => {
  await sparqlRequest({
    method: 'PUT',
    transaction: {
      transactionUrl,
      action: 'COMMIT'
    }
  })
}

/**
 * Rolls back any updates made to this transaction.
 *
 * @async
 * @function rollbackTransaction
 * @param {string} transactionUrl - The URL of the transaction to roll back.
 * @throws {Error} If there's an error rolling back the transaction.
 *
 * @example
 * try {
 *   await rollbackTransaction('http://example.com/sparql/transaction/123');
 *   console.log('Transaction rolled back successfully');
 * } catch (error) {
 *   console.error('Error rolling back transaction:', error);
 * }
 */
export const rollbackTransaction = async (transactionUrl) => {
  await sparqlRequest({
    method: 'DELETE',
    transaction: {
      transactionUrl
    }
  })
}
