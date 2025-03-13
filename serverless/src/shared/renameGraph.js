import { sparqlRequest } from './sparqlRequest'

export const renameGraph = async ({ oldGraphName, newGraphName }) => {
  const renameQuery = `
    MOVE <https://gcmd.earthdata.nasa.gov/kms/version/${oldGraphName}>
    TO <https://gcmd.earthdata.nasa.gov/kms/version/${newGraphName}>
  `

  try {
    await sparqlRequest({
      path: '/statements',
      method: 'POST',
      body: renameQuery,
      contentType: 'application/sparql-update'
    })

    console.log(`Successfully renamed graph from ${oldGraphName} to ${newGraphName}`)
  } catch (error) {
    console.error(`Error renaming graph from ${oldGraphName} to ${newGraphName}:`, error)
    throw error
  }
}
