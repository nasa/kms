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

  test('it should generate the correct update query', () => {
    const query = getPublishUpdateQuery(name, updateDate)

    expect(query).toContain(prefixes)

    // Check for dropping the existing published graph
    expect(query).toContain('DROP SILENT GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published>')

    // Check for copying draft to published
    expect(query).toContain('COPY <https://gcmd.earthdata.nasa.gov/kms/version/draft>')
    expect(query).toContain('TO <https://gcmd.earthdata.nasa.gov/kms/version/published>')

    // Check for updating metadata
    expect(query).toContain('DELETE {')
    expect(query).toContain('INSERT {')
    expect(query).toContain('GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published>')
    expect(query).toContain(`gcmd:versionName "${name}"`)
    expect(query).toContain('gcmd:versionType "published"')
    expect(query).toContain(`dcterms:created "${updateDate}"^^xsd:dateTime`)

    // Check for WHERE clause
    expect(query).toContain('WHERE {')
    expect(query).toContain('OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionName ?oldName }')
    expect(query).toContain('OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionType ?oldType }')
    expect(query).toContain('OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/version_metadata> dcterms:created ?oldCreated }')
  })
})
