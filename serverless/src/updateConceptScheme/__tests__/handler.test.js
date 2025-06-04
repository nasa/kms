import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import * as getConceptSchemeDetails from '@/shared/getConceptSchemeDetails'
import * as getSchemeInfo from '@/shared/getSchemeInfo'
import * as getSkosRootConcept from '@/shared/getSkosRootConcept'
import * as sparqlRequest from '@/shared/sparqlRequest'
import * as transactionHelpers from '@/shared/transactionHelpers'
import * as updateModifiedDate from '@/shared/updateModifiedDate'

import { updateConceptScheme } from '../handler'

vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getSkosRootConcept')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/transactionHelpers')
vi.mock('@/shared/updateModifiedDate')
vi.mock('@/shared/getSchemeInfo')

describe('updateConceptScheme', () => {
  const mockEvent = {
    body: `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                   xmlns:skos="http://www.w3.org/2004/02/skos/core#"
                   xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#"
                   xmlns:dcterms="http://purl.org/dc/terms/">
      <skos:ConceptScheme rdf:about="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/schemeA">
        <skos:prefLabel>schemeA updated long name</skos:prefLabel>
        <skos:notation>schemeA</skos:notation>
        <dcterms:modified>2025-03-31</dcterms:modified>
        <gcmd:csvHeaders>Category,Topic,Term,UpdatedColumn</gcmd:csvHeaders>
      </skos:ConceptScheme>
    </rdf:RDF>`,
    queryStringParameters: { version: 'draft' }
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  let consoleLogSpy
  let consoleErrorSpy

  beforeAll(() => {
    // Suppress console.log and console.error before all tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    // Restore console.log and console.error after all tests
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('When given valid RDF data and existing scheme, should update the scheme successfully', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'schemeA updated long name'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()
    updateModifiedDate.updateModifiedDate.mockResolvedValue(true)

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(201)
    expect(JSON.parse(result.body).message).toBe('Successfully updated concept scheme')
  })

  test('When RDF data is missing, should return an error', async () => {
    const emptyEvent = {
      ...mockEvent,
      body: ''
    }

    const result = await updateConceptScheme(emptyEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Missing RDF/XML data in request body')
  })

  test('When scheme does not exist, should return a 409 error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'nonExistentScheme',
      schemePrefLabel: 'New Scheme'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue(null)

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body).message).toBe('Scheme nonExistentScheme not found.')
  })

  test('When deleting existing scheme fails, should rollback and return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'schemeA updated long name'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValueOnce({ ok: false })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Failed to delete existing scheme')
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transactionUrl')
  })

  test('When inserting updated scheme fails, should rollback and return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'schemeA updated long name'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: false,
        status: 500
      })

    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('HTTP error! insert/update data status: 500')
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transactionUrl')
  })

  test('When updating scheme modified date fails, should rollback and return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'schemeA updated long name'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })

    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Failed to update scheme modified date')
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transactionUrl')
  })

  test('When prefLabel is changed, should update root concept prefLabel', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()
    updateModifiedDate.updateModifiedDate.mockResolvedValue(true)

    await updateConceptScheme(mockEvent)

    // Check if sparqlRequest was called with the correct arguments for updating the prefLabel
    expect(sparqlRequest.sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringMatching(/DELETE.*INSERT.*skos:prefLabel/s),
        contentType: 'application/sparql-update',
        transaction: expect.objectContaining({
          action: 'UPDATE',
          transactionUrl: 'transactionUrl'
        }),
        version: 'draft'
      })
    )

    // Verify that updateModifiedDate was called
    expect(updateModifiedDate.updateModifiedDate).toHaveBeenCalled()
  })

  test('When updating root concept prefLabel fails, should rollback and return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })

    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Failed to update root concept prefLabel')
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transactionUrl')
  })

  test('When updating root concept modified date fails, should rollback and return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()
    updateModifiedDate.updateModifiedDate.mockResolvedValue(false)

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('HTTP error! updating last modified date failed')
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transactionUrl')
  })

  test('When transaction commit fails, should return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.commitTransaction.mockRejectedValue(new Error('Commit failed'))
    updateModifiedDate.updateModifiedDate.mockResolvedValue(true)

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Commit failed')
  })

  test('When no version is provided, should use "draft" as default', async () => {
    const noVersionEvent = {
      ...mockEvent,
      queryStringParameters: {}
    }

    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()
    updateModifiedDate.updateModifiedDate.mockResolvedValue(true)

    await updateConceptScheme(noVersionEvent)

    expect(getConceptSchemeDetails.getConceptSchemeDetails).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'draft' })
    )
  })

  test('When getSchemeInfo fails, should return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockImplementation(() => {
      throw new Error('Invalid scheme info')
    })

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Invalid scheme info')
  })

  test('When scheme ID is missing, should return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({ schemePrefLabel: 'New Label' })

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Invalid or missing scheme ID')
  })

  test('When rollback fails after an error, should log the rollback error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.rollbackTransaction.mockRejectedValue(new Error('Rollback failed'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await updateConceptScheme(mockEvent)

    expect(consoleSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  test('When prefLabel is not changed, should not update root concept', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'Old Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()

    await updateConceptScheme(mockEvent)

    expect(updateModifiedDate.updateModifiedDate).not.toHaveBeenCalled()
  })

  test('When multiple SPARQL requests are made, should use the same transaction URL', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()
    updateModifiedDate.updateModifiedDate.mockResolvedValue(true)

    await updateConceptScheme(mockEvent)

    const sparqlCalls = sparqlRequest.sparqlRequest.mock.calls
    sparqlCalls.forEach((call) => {
      expect(call[0].transaction.transactionUrl).toBe('transactionUrl')
    })
  })

  test('When all operations succeed, should commit the transaction', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({ '@rdf:about': 'conceptId' })
    sparqlRequest.sparqlRequest.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()
    updateModifiedDate.updateModifiedDate.mockResolvedValue(true)

    await updateConceptScheme(mockEvent)

    expect(transactionHelpers.commitTransaction).toHaveBeenCalledWith('transactionUrl')
  })

  test('When getSkosRootConcept fails, should return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    getSkosRootConcept.getSkosRootConcept.mockRejectedValue(new Error('Root concept error'))
    transactionHelpers.startTransaction.mockResolvedValue('transactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Root concept error')
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transactionUrl')
  })

  test('When startTransaction fails, should return an error', async () => {
    getSchemeInfo.getSchemeInfo.mockReturnValue({
      schemeId: 'schemeA',
      schemePrefLabel: 'New Label'
    })

    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({ prefLabel: 'Old Label' })
    transactionHelpers.startTransaction.mockRejectedValue(new Error('Transaction start error'))

    const result = await updateConceptScheme(mockEvent)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Transaction start error')
  })

  test('When event is undefined, should handle gracefully', async () => {
    const result = await updateConceptScheme(undefined)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toBe('Error updating scheme')
    expect(JSON.parse(result.body).error).toBe('Missing RDF/XML data in request body')
  })
})
