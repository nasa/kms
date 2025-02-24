/**
 * @fileoverview Defines the RDF namespaces used throughout the application.
 * @module namespaces
 */

/**
 * An object containing RDF namespace prefixes and their corresponding URIs.
 * These namespaces are commonly used in RDF and SPARQL operations.
 *
 * @typedef {Object.<string, string>} Namespaces
 * @property {string} @xmlns:rdf - The RDF namespace URI.
 * @property {string} @xmlns:skos - The SKOS namespace URI.
 * @property {string} @xmlns:gcmd - The GCMD (Global Change Master Directory) namespace URI.
 * @property {string} @xmlns:dcterms - The Dublin Core Terms namespace URI.
 */

/**
 * The namespaces object containing predefined RDF namespace prefixes and their URIs.
 *
 * @type {Namespaces}
 */
export const namespaces = {
  '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
  '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
  '@xmlns:dcterms': 'http://purl.org/dc/terms/'
}
