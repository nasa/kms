import { format } from 'date-fns'

const getCsvMetadata = (scheme) => {
  const metadata = []
  metadata.push('Keyword Version: N')
  metadata.push('Revision: N')
  metadata.push(`Timestamp: ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}`)
  metadata.push('Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf')
  metadata.push(`The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}/?format=xml`)

  return metadata
}

export default getCsvMetadata
