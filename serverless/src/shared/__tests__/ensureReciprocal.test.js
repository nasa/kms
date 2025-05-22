import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { ensureReciprocalDeletions } from '@/shared/ensureReciprocalDeletions'
import { ensureReciprocalInsertions } from '@/shared/ensureReciprocalInsertions'

import { ensureReciprocal } from '../ensureReciprocal'

vi.mock('@/shared/ensureReciprocalDeletions')
vi.mock('@/shared/ensureReciprocalInsertions')

describe('ensureReciprocal', () => {
  const mockParams = {
    conceptId: 'testConceptId',
    version: 'testVersion',
    transactionUrl: 'testTransactionUrl'
  }

  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('When oldRdfXml is provided', () => {
    test('should call ensureReciprocalDeletions', async () => {
      const params = {
        ...mockParams,
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml'
      }
      await ensureReciprocal(params)
      expect(ensureReciprocalDeletions).toHaveBeenCalledWith(params)
    })
  })

  describe('When newRdfXml is provided', () => {
    test('should call ensureReciprocalInsertions', async () => {
      const params = {
        ...mockParams,
        newRdfXml: 'newXml'
      }
      await ensureReciprocal(params)
      expect(ensureReciprocalInsertions).toHaveBeenCalledWith({
        rdfXml: 'newXml',
        conceptId: params.conceptId,
        version: params.version,
        transactionUrl: params.transactionUrl
      })
    })
  })

  describe('When both oldRdfXml and newRdfXml are provided', () => {
    test('should call both ensureReciprocalDeletions and ensureReciprocalInsertions', async () => {
      const params = {
        ...mockParams,
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml'
      }
      await ensureReciprocal(params)
      expect(ensureReciprocalDeletions).toHaveBeenCalledWith(params)
      expect(ensureReciprocalInsertions).toHaveBeenCalledWith({
        rdfXml: 'newXml',
        conceptId: params.conceptId,
        version: params.version,
        transactionUrl: params.transactionUrl
      })
    })
  })

  describe('When neither oldRdfXml nor newRdfXml are provided', () => {
    test('should not call ensureReciprocalDeletions or ensureReciprocalInsertions', async () => {
      await ensureReciprocal(mockParams)
      expect(ensureReciprocalDeletions).not.toHaveBeenCalled()
      expect(ensureReciprocalInsertions).not.toHaveBeenCalled()
    })
  })

  describe('When an error occurs', () => {
    test('should throw the error', async () => {
      const error = new Error('Test error')
      ensureReciprocalDeletions.mockRejectedValueOnce(error)
      const params = {
        ...mockParams,
        oldRdfXml: 'oldXml'
      }
      await expect(ensureReciprocal(params)).rejects.toThrow('Test error')
    })
  })

  describe('When successful', () => {
    test('should return { ok: true }', async () => {
      const result = await ensureReciprocal(mockParams)
      expect(result).toEqual({ ok: true })
    })
  })
})
