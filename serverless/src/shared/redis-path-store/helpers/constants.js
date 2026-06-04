/**
 * Canonical delimiter used when storing or comparing keyword paths.
 *
 * @type {string}
 */
export const KEYWORD_PATH_SEPARATOR = ' > '

/**
 * Number of header rows skipped when diffing exported keyword CSV content.
 *
 * @type {number}
 */
export const KEYWORD_DIFF_SKIP_HEADER_ROWS = 2

/**
 * Full-path schemes mapped to their canonical slot order.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
export const FULL_PATH_VALUE_FIELDS = Object.freeze({
  sciencekeywords: [
    'Category',
    'Topic',
    'Term',
    'VariableLevel1',
    'VariableLevel2',
    'VariableLevel3',
    'DetailedVariable'
  ],
  locations: [
    'Category',
    'Type',
    'Subregion1',
    'Subregion2',
    'Subregion3',
    'DetailedLocation'
  ],
  chronounits: [
    'Eon',
    'Era',
    'Period',
    'Epoch',
    'Age',
    'SubAge'
  ],
  rucontenttype: [
    'URLContentType',
    'Type',
    'Subtype'
  ]
})

/**
 * Short-name schemes mapped to the fields used to rebuild canonical keyword paths.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
export const SHORT_NAME_OBJECT_FIELDS = Object.freeze({
  platforms: [
    'Category',
    'Class',
    'Type',
    'ShortName'
  ],
  instruments: [
    'Category',
    'Class',
    'Subclass',
    'ShortName'
  ],
  projects: [
    'Category',
    'ShortName'
  ],
  providers: [
    'BucketLevel0',
    'BucketLevel1',
    'BucketLevel2',
    'BucketLevel3',
    'ShortName'
  ],
  idnnode: [
    'ShortName'
  ],
  dataformat: [
    'ShortName'
  ],
  granuledataformat: [
    'ShortName'
  ]
})

/**
 * Schemes that resolve lookups by canonical full path.
 *
 * @type {readonly string[]}
 */
export const KEYWORD_LOOKUP_FULL_PATH_SCHEMES = Object.freeze([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange',
  'verticalresolutionrange',
  'productlevelid'
])

/**
 * Schemes that resolve lookups by short name.
 *
 * @type {readonly string[]}
 */
export const KEYWORD_LOOKUP_SHORT_NAME_SCHEMES = Object.freeze([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat',
  'granuledataformat'
])

/**
 * Historical-cache schemes that store entries by canonical full path.
 *
 * @type {readonly string[]}
 */
export const HISTORICAL_CACHE_FULL_PATH_SCHEMES = Object.freeze([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange'
])

/**
 * Historical-cache schemes that store entries by short name.
 *
 * @type {readonly string[]}
 */
export const HISTORICAL_CACHE_SHORT_NAME_SCHEMES = Object.freeze([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat'
])

/**
 * Published-cache schemes that store entries by canonical full path.
 *
 * @type {readonly string[]}
 */
export const PUBLISHED_CACHE_FULL_PATH_SCHEMES = Object.freeze([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange',
  'verticalresolutionrange',
  'productlevelid'
])

/**
 * Published-cache schemes that store entries by short name.
 *
 * @type {readonly string[]}
 */
export const PUBLISHED_CACHE_SHORT_NAME_SCHEMES = Object.freeze([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat',
  'granuledataformat'
])

/**
 * Set form of the full-path lookup scheme list.
 *
 * @type {Set<string>}
 */
export const LOOKUP_FULL_PATH_SCHEME_SET = new Set(KEYWORD_LOOKUP_FULL_PATH_SCHEMES)

/**
 * Set form of the short-name lookup scheme list.
 *
 * @type {Set<string>}
 */
export const LOOKUP_SHORT_NAME_SCHEME_SET = new Set(KEYWORD_LOOKUP_SHORT_NAME_SCHEMES)

/**
 * Set form of the historical full-path cache scheme list.
 *
 * @type {Set<string>}
 */
export const HISTORICAL_CACHE_FULL_PATH_SCHEME_SET = new Set(HISTORICAL_CACHE_FULL_PATH_SCHEMES)

/**
 * Set form of the historical short-name cache scheme list.
 *
 * @type {Set<string>}
 */
export const HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET = new Set(HISTORICAL_CACHE_SHORT_NAME_SCHEMES)

/**
 * Set form of the published full-path cache scheme list.
 *
 * @type {Set<string>}
 */
export const PUBLISHED_CACHE_FULL_PATH_SCHEME_SET = new Set(PUBLISHED_CACHE_FULL_PATH_SCHEMES)

/**
 * Set form of the published short-name cache scheme list.
 *
 * @type {Set<string>}
 */
export const PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET = new Set(PUBLISHED_CACHE_SHORT_NAME_SCHEMES)

/**
 * Version marker embedded into the Redis key used to track completed historical-cache builds.
 *
 * @type {string}
 */
export const HISTORICAL_CACHE_BUILD_MARKER_VERSION = 'v1'

/**
 * Redis key that tracks which historical RDF versions have already been cached.
 *
 * @type {string}
 */
export const HISTORICAL_CACHE_BUILT_VERSIONS_KEY = `kms:historical_concept:versions:built:${HISTORICAL_CACHE_BUILD_MARKER_VERSION}`
