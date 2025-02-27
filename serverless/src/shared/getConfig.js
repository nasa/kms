/**
 * Configuration management module for the application.
 *
 * This module provides functions to access application configuration,
 * including both static and dynamic (environment-based) configurations.
 *
 * @module getConfig
 */
import staticConfig from '@/../../static.config.json'

const getConfig = () => staticConfig

const applicationConfig = {
  ...getConfig().application,
  get sparqlQueryEndpoint() {
    return `${process.env.RDFDB_BASE_URL}${getConfig().application.sparqlServicePath}${getConfig().application.sparqlQueryPath}`
  },
  get sparqlUpdateEndpoint() {
    return `${process.env.RDFDB_BASE_URL}${getConfig().application.sparqlServicePath}${getConfig().application.sparqlUpdatePath}`
  },
  get sparqlDataEndpoint() {
    return `${process.env.RDFDB_BASE_URL}${getConfig().application.sparqlServicePath}${getConfig().application.sparqlDataPath}`
  },
  get sparqlHealthCheckEndpoint() {
    return `${process.env.RDFDB_BASE_URL}${getConfig().application.sparqlHealthCheckPath}`
  },
  get sparqlBaseUrl() {
    return `${process.env.RDFDB_BASE_URL}`
  }
}

/**
 * Application configuration object that combines static and dynamic configurations.
 *
 * @constant
 * @type {Object}
 * @property {Object} ...getConfig().application - Spreads all properties from the static application configuration.
 * @property {string} sparqlEndpoint - Dynamically constructed SPARQL endpoint URL.
 *                                     Uses the RDFDB_SERVICE_URL environment variable.
 */
export const getApplicationConfig = () => applicationConfig
