import staticConfig from '../../../static.config.json'

const getConfig = () => staticConfig

const applicationConfig = {
  ...getConfig().application,
  get sparqlEndpoint() {
    return `${process.env.RDF4J_SERVICE_URL}/rdf4j-server/repositories/kms`
  }
}

export const getApplicationConfig = () => applicationConfig
