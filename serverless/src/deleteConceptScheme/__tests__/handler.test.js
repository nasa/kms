import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import * as deleteTripleModule from '@/shared/deleteTriples'
import * as getConceptSchemeDetailsModule from '@/shared/getConceptSchemeDetails'
import * as getConfigModule from '@/shared/getConfig'
import * as getSkosRootConceptModule from '@/shared/getSkosRootConcept'
import * as transactionHelpersModule from '@/shared/transactionHelpers'

import { deleteConceptScheme } from '../handler'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getSkosRootConcept')
vi.mock('@/shared/deleteTriples')
vi.mock('@/shared/transactionHelpers')

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('deleteConceptScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
      defaultResponseHeaders: { 'Content-Type': 'application/json' }
    })

    vi.spyOn(transactionHelpersModule, 'startTransaction').mockResolvedValue('transaction-url')
    vi.spyOn(transactionHelpersModule, 'commitTransaction').mockResolvedValue()
  })

  test('When scheme is not found, should return a 404 response', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue(null)

    const event = {
      pathParameters: { schemeId: 'non-existent-scheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toEqual({ error: 'Scheme not found' })
  })

  test('When root concept has narrower concepts, should return a 422 response', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue({
      'skos:narrower': ['some-concept']
    })

    const event = {
      pathParameters: { schemeId: 'scheme-with-narrower-concepts' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(422)
    expect(JSON.parse(result.body)).toEqual({ error: "Scheme can't be deleted: Root concept has narrowers." })
  })

  test('When deletion is successful, should return a 200 response', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue({
      '@rdf:about': 'root-concept-id'
    })

    vi.spyOn(deleteTripleModule, 'deleteTriples').mockResolvedValue({ ok: true })

    const event = {
      pathParameters: { schemeId: 'deletable-scheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ message: 'Successfully deleted concept scheme: deletable-scheme' })
  })

  test('When an error occurs during deletion, should return a 500 response', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue({
      '@rdf:about': 'root-concept-id'
    })

    vi.spyOn(deleteTripleModule, 'deleteTriples').mockRejectedValue(new Error('Deletion failed'))
    vi.spyOn(transactionHelpersModule, 'rollbackTransaction').mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'error-scheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Deletion failed' })
    expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
  })

  test('When no version is provided, should use default version "draft"', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue(null)
    vi.spyOn(deleteTripleModule, 'deleteTriples').mockResolvedValue({ ok: true })

    const event = {
      pathParameters: { schemeId: 'no-version-scheme' },
      queryStringParameters: {}
    }

    await deleteConceptScheme(event)

    expect(getConceptSchemeDetailsModule.getConceptSchemeDetails).toHaveBeenCalledWith({
      schemeName: 'no-version-scheme',
      version: 'draft'
    })
  })

  test('When root concept exists, should delete both root concept and scheme', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue({
      '@rdf:about': 'root-concept-id'
    })

    const deleteTriplesSpy = vi.spyOn(deleteTripleModule, 'deleteTriples').mockResolvedValue({ ok: true })

    const event = {
      pathParameters: { schemeId: 'scheme-with-root' },
      queryStringParameters: { version: 'published' }
    }

    await deleteConceptScheme(event)

    expect(deleteTriplesSpy).toHaveBeenCalledTimes(2)
    expect(deleteTriplesSpy).toHaveBeenCalledWith(
      'https://gcmd.earthdata.nasa.gov/kms/concept/root-concept-id',
      'published',
      'transaction-url'
    )

    expect(deleteTriplesSpy).toHaveBeenCalledWith(
      'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/scheme-with-root',
      'published',
      'transaction-url'
    )
  })

  test('When root concept does not exist, should only delete the scheme', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue(null)
    const deleteTriplesSpy = vi.spyOn(deleteTripleModule, 'deleteTriples').mockResolvedValue({ ok: true })

    const event = {
      pathParameters: { schemeId: 'scheme-without-root' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ message: 'Successfully deleted concept scheme: scheme-without-root' })
    expect(deleteTriplesSpy).toHaveBeenCalledTimes(1)
    expect(deleteTriplesSpy).toHaveBeenCalledWith(
      'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/scheme-without-root',
      'draft',
      'transaction-url'
    )

    expect(getSkosRootConceptModule.getSkosRootConcept).toHaveBeenCalledWith('scheme-without-root')
  })

  test('When deletion of root concept fails, should throw an error', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue({
      '@rdf:about': 'root-concept-id'
    })

    vi.spyOn(deleteTripleModule, 'deleteTriples').mockResolvedValue({ ok: false })
    vi.spyOn(transactionHelpersModule, 'rollbackTransaction').mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'scheme-with-failed-root-deletion' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Failed to delete existing root concept' })
    expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
  })

  test('When deletion of scheme fails, should throw an error', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue(null)
    vi.spyOn(deleteTripleModule, 'deleteTriples').mockResolvedValue({ ok: false })
    vi.spyOn(transactionHelpersModule, 'rollbackTransaction').mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'scheme-with-failed-deletion' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Failed to delete existing scheme' })
    expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
  })

  test('When rollback fails after an error, should log the rollback error', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue(null)
    vi.spyOn(deleteTripleModule, 'deleteTriples').mockRejectedValue(new Error('Deletion failed'))
    vi.spyOn(transactionHelpersModule, 'rollbackTransaction').mockRejectedValue(new Error('Rollback failed'))
    const consoleSpy = vi.spyOn(console, 'error')

    const event = {
      pathParameters: { schemeId: 'scheme-with-rollback-error' },
      queryStringParameters: { version: 'draft' }
    }

    await deleteConceptScheme(event)

    expect(consoleSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))
  })

  test('When transaction commit fails, should throw an error', async () => {
    vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({})
    vi.spyOn(getSkosRootConceptModule, 'getSkosRootConcept').mockResolvedValue(null)
    vi.spyOn(deleteTripleModule, 'deleteTriples').mockResolvedValue({ ok: true })
    vi.spyOn(transactionHelpersModule, 'commitTransaction').mockRejectedValue(new Error('Commit failed'))

    const event = {
      pathParameters: { schemeId: 'scheme-with-commit-error' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Commit failed' })
  })
})
