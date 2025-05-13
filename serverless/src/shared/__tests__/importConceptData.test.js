import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { buildJsonMap } from '@/shared/buildJsonMap'
import { createSchemes } from '@/shared/createSchemes'
import { removeGraph } from '@/shared/removeGraph'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { toRDF } from '@/shared/toRDF'

import { importConceptData } from '../importConceptData'

// Mock all imported modules
vi.mock('@/shared/buildJsonMap')
vi.mock('@/shared/createSchemes')
vi.mock('@/shared/removeGraph')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/toRDF')

describe('importConceptData', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(console, 'log').mockImplementation(() => {})

    // Set up mock implementations
    buildJsonMap.mockResolvedValue({
      concept1: {
        id: 'concept1',
        data: 'json1'
      },
      concept2: {
        id: 'concept2',
        data: 'json2'
      },
      concept3: {
        id: 'concept3',
        data: 'json3'
      }
    })

    removeGraph.mockResolvedValue()
    createSchemes.mockResolvedValue()
    toRDF.mockResolvedValue('<skos:Concept>mocked RDF</skos:Concept>')
    sparqlRequest.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should process all concepts in batches', async () => {
    const jsonContent = 'mocked JSON content'
    const version = '1.0'
    const versionType = 'draft'
    const options = { minConceptsRequired: 1 }

    await importConceptData(jsonContent, version, versionType, options)

    expect(removeGraph).toHaveBeenCalledWith('1.0')
    expect(createSchemes).toHaveBeenCalledWith('1.0', 'draft')
    expect(buildJsonMap).toHaveBeenCalledWith(jsonContent)

    // Check if toRDF was called for each concept
    expect(toRDF).toHaveBeenCalledTimes(3)
    expect(toRDF).toHaveBeenCalledWith({
      id: 'concept1',
      data: 'json1'
    })

    expect(toRDF).toHaveBeenCalledWith({
      id: 'concept2',
      data: 'json2'
    })

    expect(toRDF).toHaveBeenCalledWith({
      id: 'concept3',
      data: 'json3'
    })

    // Check if sparqlRequest was called once (for one batch)
    expect(sparqlRequest).toHaveBeenCalledTimes(1)
    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      method: 'POST',
      body: expect.stringContaining('<rdf:RDF'),
      version: '1.0'
    })
  })

  test('should handle "published" versionType correctly', async () => {
    const jsonContent = 'mocked JSON content'
    const version = '1.0'
    const versionType = 'published'
    const options = { minConceptsRequired: 1 }

    await importConceptData(jsonContent, version, versionType, options)

    expect(removeGraph).toHaveBeenCalledWith('published')
    expect(createSchemes).toHaveBeenCalledWith('published', 'published')
  })

  test('should handle errors during processing', async () => {
    const jsonContent = JSON.stringify([
      {
        id: 'concept1',
        data: 'json1'
      },
      {
        id: 'concept2',
        data: 'json2'
      },
      {
        id: 'concept3',
        data: 'json3'
      }
    ])
    const version = '1.0'
    const versionType = 'draft'

    // Simulate an error in toRDF for the second concept
    // eslint-disable-next-line no-unused-vars
    toRDF.mockImplementation((json) => {
      if (json.id === 'concept2') {
        throw new Error('Mocked toRDF error')
      }

      return '<skos:Concept>mocked RDF</skos:Concept>'
    })

    sparqlRequest.mockResolvedValue({ ok: true })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const options = { minConceptsRequired: 1 }

    await importConceptData(jsonContent, version, versionType, options)

    // Check if the specific error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error processing ',
      expect.stringContaining('concept2'),
      expect.any(Error)
    )

    // Check that toRDF was called for all three concepts
    expect(toRDF).toHaveBeenCalledTimes(3)

    // Check that sparqlRequest was still called
    expect(sparqlRequest).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  test('should handle SPARQL request errors', async () => {
    const jsonContent = 'mocked JSON content'
    const version = '1.0'
    const versionType = 'draft'
    const options = { minConceptsRequired: 1 }

    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => 'Server Error'
    })

    console.error = vi.fn() // Mock console.error to check if it's called
    console.log = vi.fn() // Mock console.log to check if it's called

    await importConceptData(jsonContent, version, versionType, options)

    expect(console.log).toHaveBeenCalledWith('Response text:', 'Server Error')
    expect(console.error).toHaveBeenCalledWith('Error loading batch:', expect.any(Error))
  })

  test('should throw error for empty concept list without calling removeGraph or createSchemes', async () => {
    const jsonContent = '[]' // Empty JSON array
    const version = '1.0'
    const versionType = 'draft'
    const options = { minConceptsRequired: 1 }

    buildJsonMap.mockResolvedValue({})

    await expect(importConceptData(jsonContent, version, versionType, options))
      .rejects.toThrow(`Refusing to import data, # of concepts < ${options.minConceptsRequired}`)

    expect(removeGraph).not.toHaveBeenCalled()
    expect(createSchemes).not.toHaveBeenCalled()
    expect(buildJsonMap).toHaveBeenCalled()
    expect(toRDF).not.toHaveBeenCalled()
    expect(sparqlRequest).not.toHaveBeenCalled()
  })

  // Add a new test to verify the error is thrown when concepts are less than required
  test('should throw error when number of concepts is less than required without calling removeGraph or createSchemes', async () => {
    const jsonContent = JSON.stringify([{ id: 'concept1' }])
    const version = '1.0'
    const versionType = 'draft'
    const options = { minConceptsRequired: 2 }

    buildJsonMap.mockResolvedValue({ concept1: { id: 'concept1' } })

    await expect(importConceptData(jsonContent, version, versionType, options))
      .rejects.toThrow(`Refusing to import data, # of concepts < ${options.minConceptsRequired}`)

    expect(removeGraph).not.toHaveBeenCalled()
    expect(createSchemes).not.toHaveBeenCalled()
    expect(buildJsonMap).toHaveBeenCalled()
    expect(toRDF).not.toHaveBeenCalled()
    expect(sparqlRequest).not.toHaveBeenCalled()
  })

  test('should use default minConceptsRequired when not provided', async () => {
    const jsonContent = JSON.stringify(Array(9999).fill({ id: 'concept' }))
    const version = '1.0'
    const versionType = 'draft'

    buildJsonMap.mockResolvedValue(Object.fromEntries(Array(9999).fill(0).map((_, i) => [`concept${i}`, { id: `concept${i}` }])))

    await expect(importConceptData(jsonContent, version, versionType))
      .rejects.toThrow('Refusing to import data, # of concepts < 10000')
  })
})
