import { sparqlRequest } from './sparqlRequest'

export const copyGraph = async ({ sourceGraphName, targetGraphName }) => {
  const copyQuery = `
    COPY <https://gcmd.earthdata.nasa.gov/kms/version/${sourceGraphName}>
    TO <https://gcmd.earthdata.nasa.gov/kms/version/${targetGraphName}>
  `

  try {
    await sparqlRequest({
      path: '/statements',
      method: 'POST',
      body: copyQuery,
      contentType: 'application/sparql-update'
    })

    console.log(`Successfully copied graph from ${sourceGraphName} to ${targetGraphName}`)
  } catch (error) {
    console.error(`Error copying graph from ${sourceGraphName} to ${targetGraphName}:`, error)
    throw error
  }
}
