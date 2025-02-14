/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
import prefixNode from './prefixNode'
import processTriples from './processTriples'

const BASE_URI = 'https://gcmd.earthdata.nasa.gov/kms/concept/'

/**
 * Shortens a full URI by removing the base URI if present.
 * @param {string} fullUri - The full URI to be shortened.
 * @returns {string} The shortened URI.
 *
 * @example
 * // Example 1: URI with base
 * shortenUri('https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3')
 * // Returns: '007cc0a7-cccf-47c9-a55d-af36592055b3'
 *
 * @example
 * // Example 2: URI without base
 * shortenUri('https://example.com/some/other/uri')
 * // Returns: 'https://example.com/some/other/uri'
 */
const shortenUri = (fullUri) => {
  if (fullUri.startsWith(BASE_URI)) {
    return fullUri.substring(BASE_URI.length)
  }

  return fullUri
}

/**
 * Processes a value based on its type and format.
 * @param {Object} param0 - The value object to process.
 * @param {string} param0.type - The type of the value (e.g., 'bnode', 'uri', 'literal').
 * @param {string} param0.value - The actual value.
 * @param {string} [param0['xml:lang']] - The language tag for literals.
 * @returns {Object|string} The processed value.
 *
 * @example
 * // Example 1: Literal with language tag
 * processValue({
 *   type: 'literal',
 *   value: 'GREENLANDIAN',
 *   'xml:lang': 'en'
 * })
 * // Returns: { _text: 'GREENLANDIAN', '@xml:lang': 'en' }
 *
 * @example
 * // Example 2: URI
 * processValue({
 *   type: 'uri',
 *   value: 'https://gcmd.earthdata.nasa.gov/kms/concept/e000088a-8252-4603-ba55-38189c45612c'
 * })
 * // Returns: { '@rdf:resource': 'e000088a-8252-4603-ba55-38189c45612c' }
 *
 * @example
 * // Example 3: Blank node
 * processValue({
 *   type: 'bnode',
 *   value: '68e59f870786c032'
 * })
 * // Returns: { 'bnode:ref': '68e59f870786c032' }
 */
const processValue = ({ type, value, 'xml:lang': lang }) => {
  if (type === 'bnode') return { 'bnode:ref': value }
  if (type === 'uri') return { '@rdf:resource': shortenUri(value) }
  if (type === 'literal') {
    return lang ? {
      _text: value,
      '@xml:lang': lang
    } : value
  }

  return { _text: value }
}

/**
 * Processes a predicate-value pair and formats it according to SKOS JSON structure.
 * @param {*} value - The value to process.
 * @param {string} predicate - The predicate associated with the value.
 * @returns {Object} The processed predicate-value pair.
 *
 * @example
 * // Example 1: Literal with language tag
 * processPredicate({ _text: 'GREENLANDIAN', '@xml:lang': 'en' }, 'skos:prefLabel')
 * // Returns: { 'skos:prefLabel': 'GREENLANDIAN', '@xml:lang': 'en' }
 *
 * @example
 * // Example 2: URI resource
 * processPredicate({ '@rdf:resource': 'e000088a-8252-4603-ba55-38189c45612c' }, 'skos:broader')
 * // Returns: { 'skos:broader': { '@rdf:resource': 'e000088a-8252-4603-ba55-38189c45612c' } }
 *
 * @example
 * // Example 3: Simple string value
 * processPredicate('2019-10-22 11:54:55.0 [tstevens] Insert Concept', 'skos:changeNote')
 * // Returns: { 'skos:changeNote': '2019-10-22 11:54:55.0 [tstevens] Insert Concept' }
 */
const processPredicate = (value, predicate) => {
  const result = {}

  if (typeof value !== 'object') {
    result[predicate] = value
  } else if ('_text' in value) {
    result[predicate] = value._text
    if ('@xml:lang' in value) {
      result['@xml:lang'] = value['@xml:lang']
    }
  } else if ('@rdf:resource' in value) {
    result[predicate] = { '@rdf:resource': value['@rdf:resource'] }
  } else if ('bnode:ref' in value) {
    result[predicate] = value
  } else {
    result[predicate] = value
  }

  return result
}

/**
 * Processes a blank node reference and adds its attributes to the parent object.
 * @param {string} bnodeRef - The blank node reference.
 * @param {Object} parentObject - The parent object to which the processed attributes will be added.
 * @param {string} key - The key under which the processed attributes will be added.
 * @param {Object} bnodeMap - The map of blank nodes and their associated triples.
 *
 * @example
 * // Example: Processing a blank node reference for a gcmd:reference
 * const bnodeMap = {
 *   '68e59f870786c032': [
 *     {
 *       p: { type: 'uri', value: 'https://gcmd.earthdata.nasa.gov/kms#text' },
 *       o: { type: 'literal', value: 'International Commission on Stratigraphy (http://www.stratigraphy.org/)', 'xml:lang': 'en' }
 *     }
 *   ]
 * };
 * const parentObject = {};
 * processBnodeRef('68e59f870786c032', parentObject, 'gcmd:reference', bnodeMap);
 * // parentObject will become:
 * // {
 * //   'gcmd:reference': {
 * //     '@gcmd:text': 'International Commission on Stratigraphy (http://www.stratigraphy.org/)',
 * //     '@xml:lang': 'en'
 * //   }
 * // }
 */
const processBnodeRef = (bnodeRef, parentObject, key, bnodeMap) => {
  const bnodeTriples = bnodeMap[bnodeRef] || []
  const bnodeAttributes = {}

  bnodeTriples.forEach(({ p, o }) => {
    const predicate = `@${prefixNode(p.value)}`
    const value = processValue(o)
    const processedValue = processPredicate(value, predicate)

    Object.entries(processedValue).forEach(([k, v]) => {
      if (k === predicate && typeof v === 'object' && 'bnode:ref' in v) {
        processBnodeRef(v['bnode:ref'], bnodeAttributes, k, bnodeMap)
      } else {
        bnodeAttributes[k] = v
      }
    })
  })

  parentObject[key] = bnodeAttributes
}

/**
 * Recursively finds and processes blank nodes in the object structure.
 * @param {Object|Array} obj - The object or array to process.
 * @param {Object} parentObj - The parent object.
 * @param {string|number} currentKey - The current key or index being processed.
 * @param {Object} bnodeMap - The map of blank nodes and their associated triples.
 *
 * @example
 * // Example: Processing an object with a blank node reference
 * const obj = {
 *   'gcmd:reference': { 'bnode:ref': '68e59f870786c032' }
 * };
 * const bnodeMap = {
 *   '68e59f870786c032': [
 *     {
 *       p: { type: 'uri', value: 'https://gcmd.earthdata.nasa.gov/kms#text' },
 *       o: { type: 'literal', value: 'International Commission on Stratigraphy (http://www.stratigraphy.org/)', 'xml:lang': 'en' }
 *     }
 *   ]
 * };
 * findAndProcessBnodes(obj, {}, 'root', bnodeMap);
 * // obj will become:
 * // {
 * //   'gcmd:reference': {
 * //     '@gcmd:text': 'International Commission on Stratigraphy (http://www.stratigraphy.org/)',
 * //     '@xml:lang': 'en'
 * //   }
 * // }
 */
const findAndProcessBnodes = (obj, parentObj, currentKey, bnodeMap) => {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => findAndProcessBnodes(item, obj, index, bnodeMap))
  } else if (typeof obj === 'object' && obj !== null) {
    if ('bnode:ref' in obj) {
      processBnodeRef(obj['bnode:ref'], parentObj, currentKey, bnodeMap)
    } else {
      Object.entries(obj).forEach(([key, value]) => findAndProcessBnodes(value, obj, key, bnodeMap))
    }
  }
}

/**
 * Converts RDF triples to a SKOS JSON concept.
 * @param {string} uri - The URI of the SKOS concept.
 * @param {Array} triples - The array of RDF triples.
 * @param {Object} [customBnodeMap=null] - Optional custom blank node map.
 * @returns {Object} The SKOS JSON concept.
 *
 * @example
 * // Example: Converting triples to SKOS JSON
 * const uri = 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3';
 * const triples = [
 *   {
 *     s: { type: 'uri', value: uri },
 *     p: { type: 'uri', value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
 *     o: { type: 'literal', value: 'GREENLANDIAN', 'xml:lang': 'en' }
 *   },
 *   {
 *     s: { type: 'uri', value: uri },
 *     p: { type: 'uri', value: 'http://www.w3.org/2004/02/skos/core#broader' },
 *     o: { type: 'uri', value: 'https://gcmd.earthdata.nasa.gov/kms/concept/e000088a-8252-4603-ba55-38189c45612c' }
 *   },
 *   // ... more triples ...
 * ];
 * const skosConcept = toSkosJson(uri, triples);
 * // skosConcept will be:
 * // {
 * //   '@rdf:about': '007cc0a7-cccf-47c9-a55d-af36592055b3',
 * //   'skos:prefLabel': { _text: 'GREENLANDIAN', '@xml:lang': 'en' },
 * //   'skos:broader': { '@rdf:resource': 'e000088a-8252-4603-ba55-38189c45612c' },
 * //   // ... other properties ...
 * // }
 */
const toSkosJson = (uri, triples, customBnodeMap = null) => {
  const skosConcept = { '@rdf:about': shortenUri(uri) }
  const bnodeMap = customBnodeMap || processTriples(triples).bNodeMap

  triples.forEach(({ s, p, o }) => {
    if (s.value === uri) {
      const predicate = prefixNode(p.value)
      if (predicate !== 'rdf:type') {
        const value = processValue(o)
        if (predicate in skosConcept) {
          skosConcept[predicate] = Array.isArray(skosConcept[predicate])
            ? [...skosConcept[predicate], value]
            : [skosConcept[predicate], value]
        } else {
          skosConcept[predicate] = value
        }
      }
    }
  })

  findAndProcessBnodes(skosConcept, null, null, bnodeMap)

  return skosConcept
}

export default toSkosJson
