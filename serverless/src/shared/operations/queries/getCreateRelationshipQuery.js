import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptId } from '@/shared/sanitizeConceptId'

export const getCreateRelationshipQuery = ({
  sourceUuid, targetUuids, relationship, inverseRelationship
}) => {
  const safeSourceUuid = sanitizeConceptId(sourceUuid)
  if (safeSourceUuid === null) {
    throw new Error('Invalid sourceUuid provided')
  }

  const safeTargetUuids = targetUuids.map((uuid) => {
    const safeUuid = sanitizeConceptId(uuid)
    if (safeUuid === null) {
      throw new Error('Invalid targetUuid provided')
    }

    return safeUuid
  })
  const createDirectTriples = () => safeTargetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${safeSourceUuid}> ${relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> .`).join('\n    ')

  const createInverseTriples = () => safeTargetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${inverseRelationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${safeSourceUuid}> .`).join('\n    ')

  return `
  ${prefixes}
  INSERT {
    ${createDirectTriples()}
    ${createInverseTriples()}
  }
  WHERE {
    # Do not filter
  }
  `
}
