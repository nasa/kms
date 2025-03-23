import { XMLParser } from 'fast-xml-parser'

import { delay } from '@/shared/delay'

export const fetchConceptIds = async (version) => {
  let baseUrl = 'https://gcmd.earthdata.nasa.gov/kms/concepts?format=xml'
  if (version) {
    baseUrl += `&version=${version}`
  }

  const pageSize = 2000
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  })

  const fetchPage = async (currentPage, accumulatedUUIDs = []) => {
    const url = `${baseUrl}&page_num=${currentPage}&page_size=${pageSize}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const xmlText = await response.text()
    const data = parser.parse(xmlText)

    if (!data.concepts || !Array.isArray(data.concepts.conceptBrief)) {
      throw new Error('Unexpected data structure: conceptBrief array not found')
    }

    const newUUIDs = data.concepts.conceptBrief.map((concept) => concept['@_uuid'])
    const updatedUUIDs = [...accumulatedUUIDs, ...newUUIDs]

    const totalHits = parseInt(data.concepts.hits, 10)
    const totalPages = Math.ceil(totalHits / pageSize)

    if (currentPage < totalPages) {
      await delay(50)

      return fetchPage(currentPage + 1, updatedUUIDs)
    }

    return updatedUUIDs
  }

  try {
    return await fetchPage(1)
  } catch (error) {
    console.error('Error fetching UUIDs:', error)
    throw error
  }
}
