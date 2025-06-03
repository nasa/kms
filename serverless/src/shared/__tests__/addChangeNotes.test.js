import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { addChangeNotes } from '../addChangeNotes'

// Mock the sparqlRequest function
vi.mock('@/shared/sparqlRequest')

describe('addChangeNotes', () => {
  const mockVersion = 'draft'
  const mockTransactionUrl = 'http://example.com/transaction/1'

  beforeEach(() => {
    vi.resetAllMocks()
    // Mock the current date
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-06-01'))
  })

  test('should add change notes for added relations', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Date=2023-06-01 User Id=system System Note=Added broader relation from <123> to <456>')
    }))
  })

  test('should add change notes for removed relations', async () => {
    const addedRelations = []
    const removedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'related',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789'
      }
    ]

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Date=2023-06-01 User Id=system System Note=Removed related relation from <123> to <789>')
    }))
  })

  test('should handle both added and removed relations', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      }
    ]
    const removedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'related',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789'
      }
    ]

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Added broader relation from <123> to <456>')
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Removed related relation from <123> to <789>')
    }))
  })

  test('should use correct SPARQL query structure', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      contentType: 'application/sparql-update',
      accept: 'application/json',
      body: expect.stringMatching(/PREFIX skos:.*WITH.*INSERT.*WHERE \{ \}/s),
      version: mockVersion,
      transaction: {
        transactionUrl: mockTransactionUrl,
        action: 'UPDATE'
      }
    }))
  })

  test('should throw error when sparqlRequest fails', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500
    })

    await expect(addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl))
      .rejects.toThrow('Failed to add change notes: 500')
  })

  test('should handle empty arrays of relations', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes([], [], mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.not.stringContaining('System Note=')
    }))
  })

  test('should correctly extract UUIDs from URIs', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123-456-789',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/987-654-321'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('from <123-456-789> to <987-654-321>')
    }))
  })

  test('should handle multiple change notes', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      },
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
        relation: 'narrower',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/012'
      }
    ]
    const removedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/345',
        relation: 'related',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/678'
      }
    ]

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    const sparqlCall = sparqlRequest.mock.calls[0][0]
    expect(sparqlCall.body).toContain('Added broader relation from <123> to <456>')
    expect(sparqlCall.body).toContain('Added narrower relation from <789> to <012>')
    expect(sparqlCall.body).toContain('Removed related relation from <345> to <678>')
  })

  test('should use the correct version in the SPARQL query', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      }
    ]
    const removedRelations = []
    const testVersion = 'published'

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, testVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`WITH <https://gcmd.earthdata.nasa.gov/kms/version/${testVersion}>`),
      version: testVersion
    }))
  })

  test('should handle relations with special characters', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'has_part',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Added has_part relation from <123> to <456>')
    }))
  })

  test('should escape double quotes in change notes', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456"with"quotes'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Added broader relation from <123> to <456"with"quotes>')
      })
    )
  })

  test('should handle network errors', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl))
      .rejects.toThrow('Network error')
  })
})
