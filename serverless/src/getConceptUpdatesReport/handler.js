import { getConceptChangeNotes } from '@/shared/getConceptChangeNotes'
import { getApplicationConfig } from '@/shared/getConfig'

export const getConceptUpdatesReport = async (event) => {
  // Extract configuration and parameters
  const { defaultResponseHeaders } = getApplicationConfig()
  const queryStringParameters = event.queryStringParameters || {}
  // Scheme and userId optional
  const {
    version, scheme, startDate, endDate, userId
  } = queryStringParameters

  const changeNoteTriples = getConceptChangeNotes({
    version,
    scheme,
    startDate,
    endDate
  })
}

export default getConceptUpdatesReport
