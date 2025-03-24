/* eslint-disable no-await-in-loop */
import https from 'https'

import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import fetch from 'node-fetch'

import { delay } from '@/shared/delay'

const PAGE_SIZE = 2000

export const fetchPagedConceptData = async (format, apiEndpoint, version) => {
  let baseUrl = `${apiEndpoint}/kms/concepts_to_rdf_repo?format=${format}`
  if (version && version !== 'published') {
    baseUrl += `&version=${version}`
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    suppressEmptyNode: true
  })

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    suppressEmptyNode: true
  })

  let allContent = format === 'json' ? '[' : ''
  let currentPage = 1
  let totalPages = 1
  let isFirstPage = true

  do {
    console.log(`Fetching page ${currentPage} for ${version} with ${format}`)
    const url = `${baseUrl}&page_num=${currentPage}&page_size=${PAGE_SIZE}`
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    })
    const response = await fetch(url, { agent: httpsAgent })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const totalHits = response.headers.get('Total-Count')
    if (!totalHits) {
      throw new Error('Invalid Total-Count header')
    }

    totalPages = Math.ceil(parseInt(totalHits, 10) / PAGE_SIZE)

    const content = await response.text()

    if (format === 'json') {
      const jsonContent = JSON.parse(content)
      if (!Array.isArray(jsonContent)) {
        throw new Error('Invalid JSON response: expected an array')
      }

      if (!isFirstPage) {
        allContent += ','
      }

      allContent += jsonContent.map((item) => JSON.stringify(item)).join(',')
    } else {
      const xmlData = parser.parse(content)
      const concepts = xmlData.concepts.concept || []
      allContent += concepts.map((c) => builder.build({ concept: c })).join('')
    }

    currentPage += 1
    isFirstPage = false
    if (currentPage <= totalPages) {
      await delay(50)
    }
  } while (currentPage <= totalPages)

  if (format === 'json') {
    allContent += ']'
  } else {
    allContent = `<concepts>${allContent}</concepts>`
  }

  return allContent
}
