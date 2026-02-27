#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */

const fs = require('node:fs')
const path = require('node:path')

const { XMLBuilder, XMLParser } = require('fast-xml-parser')

const DEFAULT_PAGE_SIZE = Number(process.env.CMR_PAGE_SIZE || '2000')
const DEFAULT_BASE_URL = process.env.CMR_BASE_URL || 'https://cmr.earthdata.nasa.gov'
const DEFAULT_OUT_DIR = process.env.RDF4J_PULL_OUT_DIR || 'setup/data'
const MAX_PAGES = Number(process.env.CMR_MAX_PAGES || '0')
const DEFAULT_XML_BASE = process.env.RDF4J_XML_BASE || 'https://gcmd.earthdata.nasa.gov/kms/concept/'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  isArray: (name) => name === 'skos:Concept'
})

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  format: true
})

const asArray = (value) => {
  if (value === undefined || value === null) return []

  return Array.isArray(value) ? value : [value]
}

const buildPageUrl = (version, pageNum, pageSize) => {
  const url = new URL(`${DEFAULT_BASE_URL}/kms/concepts`)
  url.searchParams.set('version', version)
  url.searchParams.set('format', 'rdf')
  url.searchParams.set('page_num', String(pageNum))
  url.searchParams.set('page_size', String(pageSize))

  return url.toString()
}

const buildSchemesUrl = (version) => {
  const url = new URL(`${DEFAULT_BASE_URL}/kms/concept_schemes`)
  url.searchParams.set('version', version)
  url.searchParams.set('format', 'rdf')

  return url.toString()
}

const buildConceptVersionsUrl = (version) => `${DEFAULT_BASE_URL}/kms/concept_versions/version_type/${version}`

const downloadConceptsForVersion = async (version) => {
  const firstUrl = buildPageUrl(version, 1, DEFAULT_PAGE_SIZE)
  const firstResponse = await fetch(firstUrl)
  if (!firstResponse.ok) {
    throw new Error(`[${version}] Failed page 1: ${firstResponse.status} ${firstResponse.statusText}`)
  }

  const totalPagesHeader = Number(firstResponse.headers.get('x-total-pages') || '1')
  const totalPages = MAX_PAGES > 0
    ? Math.min(totalPagesHeader, MAX_PAGES)
    : totalPagesHeader

  const firstBody = await firstResponse.text()
  const firstParsed = parser.parse(firstBody)
  const firstRdf = firstParsed?.['rdf:RDF']
  if (!firstRdf) {
    throw new Error(`[${version}] Invalid RDF payload on page 1`)
  }

  const rootAttrs = Object.keys(firstRdf)
    .filter((key) => key.startsWith('@'))
    .reduce((acc, key) => ({
      ...acc,
      [key]: firstRdf[key]
    }), {})
  if (!rootAttrs['@xml:base']) {
    rootAttrs['@xml:base'] = DEFAULT_XML_BASE
  }

  const metadata = firstRdf['gcmd:gcmd']
  const concepts = [...asArray(firstRdf['skos:Concept'])]
  const pageNumbers = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2)
  const pageConceptSets = await Promise.all(pageNumbers.map(async (pageNum) => {
    const pageUrl = buildPageUrl(version, pageNum, DEFAULT_PAGE_SIZE)
    console.log(`[${version}] downloading page ${pageNum}/${totalPages}`)
    const response = await fetch(pageUrl)
    if (!response.ok) {
      throw new Error(`[${version}] Failed page ${pageNum}: ${response.status} ${response.statusText}`)
    }

    const body = await response.text()
    const parsed = parser.parse(body)
    const rdf = parsed?.['rdf:RDF']

    return asArray(rdf?.['skos:Concept'])
  }))
  concepts.push(...pageConceptSets.flat())

  const merged = {
    'rdf:RDF': {
      ...rootAttrs,
      ...(metadata ? { 'gcmd:gcmd': metadata } : {}),
      'skos:Concept': concepts
    }
  }

  return {
    totalPages,
    conceptsCount: concepts.length,
    xml: builder.build(merged)
  }
}

const downloadSchemesForVersion = async (version) => {
  const url = buildSchemesUrl(version)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`[${version}] Failed schemes download: ${response.status} ${response.statusText}`)
  }

  const xml = await response.text()
  const parsed = parser.parse(xml)
  const schemesRoot = parsed?.schemes
  const schemes = asArray(schemesRoot?.scheme)

  if (!schemes.length) {
    throw new Error(`[${version}] Invalid concept_schemes payload`)
  }

  const conceptSchemes = schemes.map((scheme) => {
    const name = scheme?.['@name']
    const longName = scheme?.['@longName']
    const updateDate = scheme?.['@updateDate']
    const csvHeaders = scheme?.['@csvHeaders']

    const conceptScheme = {
      '@rdf:about': `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${name}`,
      'skos:prefLabel': {
        '@xml:lang': 'en',
        '#text': longName || name
      },
      'skos:notation': name
    }

    if (updateDate) {
      conceptScheme['dcterms:modified'] = {
        '@rdf:datatype': 'http://www.w3.org/2001/XMLSchema#date',
        '#text': updateDate
      }
    }

    if (csvHeaders) {
      conceptScheme['gcmd:csvHeaders'] = csvHeaders
    }

    return conceptScheme
  })

  const rdf = {
    'rdf:RDF': {
      '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '@xmlns:rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      '@xmlns:dcterms': 'http://purl.org/dc/terms/',
      '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
      'skos:ConceptScheme': conceptSchemes
    }
  }

  return builder.build(rdf)
}

const downloadVersionMetadata = async (version) => {
  const url = buildConceptVersionsUrl(version)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`[${version}] Failed concept_versions download: ${response.status} ${response.statusText}`)
  }

  const xml = await response.text()
  const parsed = parser.parse(xml)
  const versions = asArray(parsed?.versions?.version)
  const match = versions.find((item) => String(item?.['@type'] || '').toLowerCase() === version.toLowerCase()) || versions[0]

  if (!match) {
    throw new Error(`[${version}] Invalid concept_versions payload`)
  }

  return {
    versionType: String(match?.['@type'] || version),
    versionName: String(match?.['#text'] || version),
    created: String(match?.['@creation_date'] || '').trim()
  }
}

const main = async () => {
  fs.mkdirSync(DEFAULT_OUT_DIR, { recursive: true })
  const versions = ['published', 'draft']
  const processVersion = async (version) => {
    console.log(`[${version}] Pulling concepts from CMR`)
    const result = await downloadConceptsForVersion(version)
    const outputFile = path.join(DEFAULT_OUT_DIR, `concepts_${version}.rdf`)
    fs.writeFileSync(outputFile, `${result.xml}\n`, 'utf8')
    console.log(
      `[${version}] wrote ${outputFile} concepts=${result.conceptsCount} pages=${result.totalPages}`
    )

    console.log(`[${version}] Pulling concept schemes from CMR`)
    const schemesXml = await downloadSchemesForVersion(version)
    const versionMetadata = await downloadVersionMetadata(version)
    const schemesParsed = parser.parse(schemesXml)
    const schemeRdf = schemesParsed?.['rdf:RDF'] || {}
    schemeRdf['gcmd:Version'] = {
      '@rdf:about': 'https://gcmd.earthdata.nasa.gov/kms/version_metadata',
      'gcmd:versionName': versionMetadata.versionName,
      'gcmd:versionType': versionMetadata.versionType,
      ...(versionMetadata.created ? {
        'dcterms:created': versionMetadata.created,
        'dcterms:modified': versionMetadata.created
      } : {})
    }

    const schemesXmlWithVersion = builder.build({ 'rdf:RDF': schemeRdf })
    const schemesFile = path.join(DEFAULT_OUT_DIR, `schemes_${version}.rdf`)
    fs.writeFileSync(schemesFile, `${schemesXmlWithVersion.trim()}\n`, 'utf8')
    console.log(`[${version}] wrote ${schemesFile}`)
  }

  await Promise.all(versions.map(processVersion))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
