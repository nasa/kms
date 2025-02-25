import getRootConcept from './getRootConcept'
import getNarrowersMap from './getNarrowersMap'
import getLongNamesMap from './getLongNamesMap'
import getProviderUrlsMap from './getProviderUrlsMap'
import traverseGraph from './traverseGraph'

const getCsvPaths = async (scheme, csvHeadersCount) => {
  const root = await getRootConcept(scheme)

  const node = {
    prefLabel: root?.prefLabel.value,
    narrowerPrefLabel: root?.prefLabel.value,
    uri: root?.subject.value
  }

  const narrowersMap = await getNarrowersMap(scheme)
  const longNamesMap = await getLongNamesMap(scheme)
  let providerUrlsMap = []
  if (scheme === 'providers') {
    providerUrlsMap = await getProviderUrlsMap(scheme)
  }

  const keywords = []
  await traverseGraph(csvHeadersCount, providerUrlsMap, longNamesMap, scheme, node, narrowersMap, [], keywords)

  return keywords.reverse()
}

export default getCsvPaths
