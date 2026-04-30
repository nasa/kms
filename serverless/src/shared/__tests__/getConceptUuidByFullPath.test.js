import {
  describe,
  expect,
  test
} from 'vitest'

import { getConceptUuidByFullPath } from '../getConceptUuidByFullPath'

describe('getConceptUuidByFullPath', () => {
  test('returns the current placeholder for a full path lookup', async () => {
    await expect(getConceptUuidByFullPath({
      fullPath: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })).resolves.toBe(
      '[resolve old keyword from UMM-C value: EARTH SCIENCE|ATMOSPHERE|AEROSOLS]'
    )
  })

  test('throws when full path is missing', async () => {
    await expect(getConceptUuidByFullPath({})).rejects.toThrow(
      'Missing full path for concept uuid lookup stub'
    )
  })
})
