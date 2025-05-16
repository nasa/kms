import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getPublishUpdateQuery } from '../getPublishUpdateQuery'

describe('getPublishUpdateQuery', () => {
  const name = 'v1.0.0'
  const updateDate = '2023-06-01T12:00:00Z'

  describe('when published version exists', () => {
    test('it should move published to past published and update metadata', () => {
      const metadata = { versionName: 'v0.9.0' }
      const query = getPublishUpdateQuery(name, updateDate, metadata)

      expect(query).toContain(prefixes)
      expect(query).toContain('MOVE <https://gcmd.earthdata.nasa.gov/kms/version/published>')
      expect(query).toContain(`TO <https://gcmd.earthdata.nasa.gov/kms/version/${metadata.versionName}>`)
      expect(query).toContain('gcmd:versionType "past_published"')
      expect(query).toContain(`gcmd:versionName "${name}"`)
      expect(query).toContain(`dcterms:created "${updateDate}"^^xsd:dateTime`)
    })
  })

  describe('when published version does not exist', () => {
    test('it should not include move operation', () => {
      const query = getPublishUpdateQuery(name, updateDate, null)

      expect(query).toContain(prefixes)
      expect(query).not.toContain('MOVE <https://gcmd.earthdata.nasa.gov/kms/version/published>')
      expect(query).not.toContain('gcmd:versionType "past_published"')
      expect(query).toContain(`gcmd:versionName "${name}"`)
      expect(query).toContain(`dcterms:created "${updateDate}"^^xsd:dateTime`)
    })
  })

  test('it should always copy draft to published', () => {
    const query = getPublishUpdateQuery(name, updateDate, null)

    expect(query).toContain('COPY <https://gcmd.earthdata.nasa.gov/kms/version/draft>')
    expect(query).toContain('TO <https://gcmd.earthdata.nasa.gov/kms/version/published>')
  })

  test('it should always update published metadata', () => {
    const query = getPublishUpdateQuery(name, updateDate, null)

    expect(query).toContain('DELETE {')
    expect(query).toContain('INSERT {')
    expect(query).toContain('GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published>')
    expect(query).toContain(`gcmd:versionName "${name}"`)
    expect(query).toContain('gcmd:versionType "published"')
    expect(query).toContain(`dcterms:created "${updateDate}"^^xsd:dateTime`)
  })
})
