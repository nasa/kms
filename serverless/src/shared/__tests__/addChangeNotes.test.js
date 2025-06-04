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
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Date=2023-06-01 User Id=system System Note=Added broader relation from Concept A [123] to Concept B [456]')
    }))
  })

  test('should add change notes for removed relations', async () => {
    const addedRelations = []
    const removedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'related',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept C'
      }
    ]

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Date=2023-06-01 User Id=system System Note=Removed related relation from Concept A [123] to Concept C [789]')
    }))
  })

  test('should handle both added and removed relations', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
      }
    ]
    const removedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'related',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept C'
      }
    ]

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Added broader relation from Concept A [123] to Concept B [456]')
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Removed related relation from Concept A [123] to Concept C [789]')
    }))
  })

  test('should use correct SPARQL query structure', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
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
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
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

  test('should correctly extract UUIDs from URIs and include prefLabels', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123-456-789',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/987-654-321',
        fromPrefLabel: 'Concept X',
        toPrefLabel: 'Concept Y'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('from Concept X [123-456-789] to Concept Y [987-654-321]')
    }))
  })

  test('should handle multiple change notes', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
      },
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
        relation: 'narrower',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/012',
        fromPrefLabel: 'Concept C',
        toPrefLabel: 'Concept D'
      }
    ]
    const removedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/345',
        relation: 'related',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/678',
        fromPrefLabel: 'Concept E',
        toPrefLabel: 'Concept F'
      }
    ]

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    const sparqlCall = sparqlRequest.mock.calls[0][0]
    expect(sparqlCall.body).toContain('Added broader relation from Concept A [123] to Concept B [456]')
    expect(sparqlCall.body).toContain('Added narrower relation from Concept C [789] to Concept D [012]')
    expect(sparqlCall.body).toContain('Removed related relation from Concept E [345] to Concept F [678]')
  })

  test('should use the correct version in the SPARQL query', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
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
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A & B',
        toPrefLabel: 'Concept C > D'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Added has_part relation from Concept A & B [123] to Concept C > D [456]')
    }))
  })

  test('should handle double quotes in change notes', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456"with"quotes',
        fromPrefLabel: 'Concept "A"',
        toPrefLabel: 'Concept "B"'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Added broader relation from Concept "A" [123] to Concept "B" [456"with"quotes]')
      })
    )
  })

  test('should generate correct SPARQL query with quotes', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456"with"quotes',
        fromPrefLabel: 'Concept "A"',
        toPrefLabel: 'Concept "B"'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    const expectedQueryPart = `
    <https://gcmd.earthdata.nasa.gov/kms/concept/123> skos:changeNote "Date=2023-06-01 User Id=system System Note=Added broader relation from Concept "A" [123] to Concept "B" [456"with"quotes]" .
  `.trim()

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(expectedQueryPart)
      })
    )
  })

  test('should handle network errors', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
      }
    ]
    const removedRelations = []

    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl))
      .rejects.toThrow('Network error')
  })

  test('should handle missing prefLabels', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      // Missing fromPrefLabel and toPrefLabel
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Added broader relation from undefined [123] to undefined [456]')
      })
    )
  })

  test('should handle empty prefLabels', async () => {
    const addedRelations = [
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123',
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: '',
        toPrefLabel: ''
      }
    ]
    const removedRelations = []

    sparqlRequest.mockResolvedValue({ ok: true })

    await addChangeNotes(addedRelations, removedRelations, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('Added broader relation from  [123] to  [456]')
    }))
  })
})
