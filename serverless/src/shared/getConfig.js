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
  get sparqlEndpoint() {
    return `${process.env.RDF4J_SERVICE_URL || 'http://localhost:8081'}/rdf4j-server/repositories/kms`
  }
}

/**
 * Application configuration object that combines static and dynamic configurations.
 *
 * @constant
 * @type {Object}
 * @property {Object} ...getConfig().application - Spreads all properties from the static application configuration.
 * @property {string} sparqlEndpoint - Dynamically constructed SPARQL endpoint URL.
 *                                     Uses the RDF4J_SERVICE_URL environment variable.
 */
export const getApplicationConfig = () => applicationConfig
export const getEdlConfig = () => getConfig().edl
