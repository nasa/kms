import {
  describe,
  expect,
  test
} from 'vitest'

import { getConceptUuidByShortName } from '../getConceptUuidByShortName'

describe('getConceptUuidByShortName', () => {
  test('returns the current placeholder for a short name lookup', async () => {
    await expect(getConceptUuidByShortName({
      shortName: 'HU-25A'
    })).resolves.toBe('[resolve old keyword from UMM-C value: HU-25A]')
  })

  test('throws when short name is missing', async () => {
    await expect(getConceptUuidByShortName({})).rejects.toThrow(
      'Missing short name for concept uuid lookup stub'
    )
  })
})
