import getRootConcept from './getRootConcept'
import getNarrowersMap from './getNarrowersMap'
import traverseGraph from './traverseGraph'
import getLongNamesMap from './getLongNamesMap'
import getProviderUrlsMap from './getProviderUrlsMap'

const getPaths = async (scheme, maxLevel) => {
  const root = await getRootConcept(scheme)

  const node = {
    prefLabel: root.prefLabel.value,
    narrowerPrefLabel: root.prefLabel.value,
    uri: root.subject.value
  }

  const narrowersMap = await getNarrowersMap(scheme)
  const longNamesMap = await getLongNamesMap(scheme)
  let providerUrlsMap = []
  if (scheme === 'providers') {
    providerUrlsMap = await getProviderUrlsMap(scheme)
  }

  const keywords = []
  await traverseGraph(maxLevel, providerUrlsMap, longNamesMap, scheme, node, narrowersMap, [], keywords)

  return keywords.reverse()
}

export default getPaths
