import {
  describe,
  it,
  expect
} from 'vitest'
import getCsvHeaders from '../getCsvHeaders'

describe('getCsvHeaders', () => {
  it('should return correct headers for chronounits', () => {
    const headers = getCsvHeaders('chronounits')
    expect(headers).toEqual(['Eon', 'Era', 'Period', 'Epoch', 'Age', 'Sub-Age', 'UUID'])
  })

  it('should return correct headers for sciencekeywords', () => {
    const headers = getCsvHeaders('sciencekeywords')
    expect(headers).toEqual(['Category', 'Topic', 'Term', 'Variable_Level_1', 'Variable_Level_2', 'Variable_Level_3', 'Detailed_Variable', 'UUID'])
  })

  it('should return correct headers for locations', () => {
    const headers = getCsvHeaders('locations')
    expect(headers).toEqual(['Location_Category', 'Location_Type', 'Location_Subregion1', 'Location_Subregion2', 'Location_Subregion3', 'Location_Subregion4', 'UUID'])
  })

  it('should return correct headers for providers', () => {
    const headers = getCsvHeaders('providers')
    expect(headers).toEqual(['Bucket_Level0', 'Bucket_Level1', 'Bucket_Level2', 'Bucket_Level3', 'Short_Name', 'Long_Name', 'Data_Center_URL', 'UUID'])
  })

  it('should return correct headers for platforms', () => {
    const headers = getCsvHeaders('platforms')
    expect(headers).toEqual(['Basis', 'Category', 'Sub_Category', 'Short_Name', 'Long_Name', 'UUID'])
  })

  it('should return correct headers for instruments', () => {
    const headers = getCsvHeaders('instruments')
    expect(headers).toEqual(['Category', 'Class', 'Type', 'Subtype', 'Short_Name', 'Long_Name', 'UUID'])
  })

  it('should return correct headers for projects', () => {
    const headers = getCsvHeaders('projects')
    expect(headers).toEqual(['Bucket', 'Short_Name', 'Long_Name', 'UUID'])
  })

  it('should return correct headers for discipline', () => {
    const headers = getCsvHeaders('discipline')
    expect(headers).toEqual(['Discipline_Name', 'Subdiscipline', 'UUID'])
  })

  it('should return correct headers for idnnode', () => {
    const headers = getCsvHeaders('idnnode')
    expect(headers).toEqual(['Short_Name', 'Long_Name', 'UUID'])
  })

  it('should return correct headers for isotopiccategory', () => {
    const headers = getCsvHeaders('isotopiccategory')
    expect(headers).toEqual(['ISO_Topic_Category', 'UUID'])
  })

  it('should return correct headers for rucontenttype', () => {
    const headers = getCsvHeaders('rucontenttype')
    expect(headers).toEqual(['URLContentType', 'Type', 'Subtype', 'UUID'])
  })

  it('should return correct headers for rucontenttype_heritage', () => {
    const headers = getCsvHeaders('rucontenttype_heritage')
    expect(headers).toEqual(['Type', 'Subtype', 'UUID'])
  })

  it('should return correct headers for horizontalresolutionrange', () => {
    const headers = getCsvHeaders('horizontalresolutionrange')
    expect(headers).toEqual(['Horizontal_Resolution_Range', 'UUID'])
  })

  it('should return correct headers for verticalresolutionrange', () => {
    const headers = getCsvHeaders('verticalresolutionrange')
    expect(headers).toEqual(['Vertical_Resolution_Range', 'UUID'])
  })

  it('should return correct headers for temporalresolutionrange', () => {
    const headers = getCsvHeaders('temporalresolutionrange')
    expect(headers).toEqual(['Temporal_Resolution_Range', 'UUID'])
  })

  it('should return correct headers for measurementname', () => {
    const headers = getCsvHeaders('measurementname')
    expect(headers).toEqual(['Context_Medium', 'Object', 'Quantity', 'UUID'])
  })

  it('should return correct headers for dataformat', () => {
    const headers = getCsvHeaders('dataformat')
    expect(headers).toEqual(['Short_Name', 'Long_Name', 'UUID'])
  })

  it('should return an empty array for unknown scheme', () => {
    const headers = getCsvHeaders('unknownscheme')
    expect(headers).toEqual([])
  })

  it('should return an empty array for undefined scheme', () => {
    const headers = getCsvHeaders(undefined)
    expect(headers).toEqual([])
  })

  it('should return an empty array for null scheme', () => {
    const headers = getCsvHeaders(null)
    expect(headers).toEqual([])
  })
})
