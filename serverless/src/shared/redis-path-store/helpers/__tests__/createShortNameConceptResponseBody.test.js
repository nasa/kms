import { createShortNameConceptResponseBody } from '../createShortNameConceptResponseBody'

describe('createShortNameConceptResponseBody', () => {
  test('includes optional long name and provider url fields when present', () => {
    expect(createShortNameConceptResponseBody({
      uuid: 'uuid-1',
      fullPath: 'NASA > GHRC_DAAC',
      longName: 'Global Hydrology Resource Center',
      providerUrl: 'https://ghrc.nsstc.nasa.gov',
      keywordObject: {
        ShortName: 'GHRC_DAAC'
      }
    })).toEqual({
      uuid: 'uuid-1',
      fullPath: 'NASA > GHRC_DAAC',
      longName: 'Global Hydrology Resource Center',
      providerUrl: 'https://ghrc.nsstc.nasa.gov',
      keywordObject: {
        ShortName: 'GHRC_DAAC'
      }
    })
  })

  test('omits optional fields when they are blank', () => {
    expect(createShortNameConceptResponseBody({
      uuid: 'uuid-2',
      fullPath: 'Aqua',
      longName: '',
      providerUrl: '',
      keywordObject: {
        ShortName: 'Aqua'
      }
    })).toEqual({
      uuid: 'uuid-2',
      fullPath: 'Aqua',
      keywordObject: {
        ShortName: 'Aqua'
      }
    })
  })
})
