import {
  describe,
  expect,
  test
} from 'vitest'

import { resolveAuditProviderId } from '../cmrWritebackProviders'

describe('resolveAuditProviderId', () => {
  test('normalizes a supplied provider and gives it precedence over the collection suffix', () => {
    expect(resolveAuditProviderId({
      providerId: ' edf_dev01 ',
      collectionConceptId: 'C123-SCIOPS'
    })).toBe('EDF_DEV01')
  })

  test('derives the provider when CMR retrieval has not supplied one', () => {
    const values = [undefined, null, '', '  ']
    values.forEach((providerId) => {
      expect(resolveAuditProviderId({
        providerId,
        collectionConceptId: 'C123-edf_dev01'
      })).toBe('EDF_DEV01')
    })
  })

  test('does not infer a provider from a missing or invalid collection identifier', () => {
    const values = [undefined, null, '', 'not-a-concept-id', 'G123-SCIOPS', 'C123-']
    values.forEach(
      (collectionConceptId) => {
        expect(resolveAuditProviderId({ collectionConceptId })).toBeUndefined()
      }
    )

    expect(resolveAuditProviderId()).toBeUndefined()
  })

  test('retains a supplied provider when the collection identifier is unavailable', () => {
    expect(resolveAuditProviderId({ providerId: ' sciops ' })).toBe('SCIOPS')
  })
})
