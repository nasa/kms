import { sparqlRequest } from './sparqlRequest'

export const startTransaction = async () => {
  const response = await sparqlRequest({
    path: '/transactions',
    method: 'POST'
  })

  return response.headers.get('Location')
}

export const commitTransaction = async (transactionUrl) => {
  await sparqlRequest({
    transaction: {
      transactionUrl,
      action: 'COMMIT'
    },
    method: 'PUT'
  })
}

export const rollbackTransaction = async (transactionUrl) => {
  await sparqlRequest({
    transaction: {
      transactionUrl
    },
    method: 'DELETE'
  })
}
