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
 * Exact CSV column names and canonical hierarchy order used by each keyword scheme.
 * UUID, Long_Name, and Data_Center_URL are auxiliary fields and are intentionally omitted.
 *
 * @type {Readonly<Record<string, string|string[]>>}
 */
export const CSV_FIELDS = Object.freeze({
  category: 'Category',
  shortName: 'ShortName',
  providerRole: 'BucketLevel0',
  urlContentType: 'URLContentType',
  type: 'Type',
  subtype: 'Subtype',
  isoTopicCategory: 'ISOTopicCategory',
  productLevelId: 'ProductLevelId',
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
    'LocationCategory',
    'LocationType',
    'LocationSubregion1',
    'LocationSubregion2',
    'LocationSubregion3',
    'LocationSubregion4'
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
  ],
  platforms: [
    'Basis',
    'Category',
    'SubCategory',
    'ShortName'
  ],
  instruments: [
    'Category',
    'Class',
    'Type',
    'Subtype',
    'ShortName'
  ],
  projects: [
    'Bucket',
    'ShortName'
  ],
  providers: [
    'BucketLevel0',
    'BucketLevel1',
    'BucketLevel2',
    'BucketLevel3',
    'ShortName'
  ],
  idnnode: ['ShortName'],
  dataformat: ['ShortName'],
  granuledataformat: ['ShortName'],
  discipline: ['DisciplineName', 'Subdiscipline'],
  isotopiccategory: ['ISOTopicCategory'],
  temporalresolutionrange: ['TemporalResolutionRange'],
  verticalresolutionrange: ['VerticalResolutionRange'],
  horizontalresolutionrange: ['HorizontalResolutionRange'],
  productlevelid: ['ProductLevelId'],
  measurementname: ['ContextMedium', 'Object', 'Quantity']
})

/**
 * Native UMM-C JSON fields used when reading and writing metadata.
 *
 * @type {Readonly<Record<string, string|string[]>>}
 */
export const UMMC_FIELDS = Object.freeze({
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
    'Stage',
    'DetailedClassification'
  ],
  platformType: 'Type',
  shortName: 'ShortName',
  longName: 'LongName',
  rucontenttype: ['URLContentType', 'Type', 'Subtype'],
  dataformat: 'Format',
  processingLevelId: 'Id'
})

/**
 * Native ECHO10 XML fields used when reading and writing metadata.
 *
 * @type {Readonly<Record<string, string|string[]>>}
 */
export const ECHO10_FIELDS = Object.freeze({
  sciencekeywords: [
    'CategoryKeyword',
    'TopicKeyword',
    'TermKeyword',
    'VariableLevel1Keyword/Value',
    'VariableLevel1Keyword/VariableLevel2Keyword/Value',
    'VariableLevel1Keyword/VariableLevel2Keyword/VariableLevel3Keyword',
    'DetailedVariableKeyword'
  ],
  platformType: 'Type',
  shortName: 'ShortName',
  longName: 'LongName',
  providers: ['Role', 'OrganizationName'],
  providerOrganizationName: 'OrganizationName',
  processingCenter: '//Collection/ProcessingCenter',
  archiveCenter: '//Collection/ArchiveCenter',
  rucontenttype: ['Type'],
  relatedUrlType: 'Type'
})

/**
 * Native DIF10 XML fields used when reading and writing metadata.
 *
 * @type {Readonly<Record<string, string|string[]>>}
 */
export const DIF10_FIELDS = Object.freeze({
  sciencekeywords: [
    'Category',
    'Topic',
    'Term',
    'Variable_Level_1',
    'Variable_Level_2',
    'Variable_Level_3',
    'Detailed_Variable'
  ],
  locations: [
    'Location_Category',
    'Location_Type',
    'Location_Subregion1',
    'Location_Subregion2',
    'Location_Subregion3',
    'Detailed_Location'
  ],
  chronounits: [
    'Eon',
    'Era',
    'Period',
    'Epoch',
    'Stage',
    'Detailed_Classification'
  ],
  platformType: 'Type',
  shortName: 'Short_Name',
  longName: 'Long_Name',
  providerShortName: 'Organization_Name/Short_Name',
  providerLongName: 'Organization_Name/Long_Name',
  rucontenttype: ['Type', 'Subtype']
})

/**
 * Native ISO 19115 XML fields used when reading and writing metadata.
 *
 * @type {Readonly<Record<string, string|string[]>>}
 */
export const ISO19115_FIELDS = Object.freeze({
  keywordValue: ['gmx:Anchor', 'gco:CharacterString'],
  keywordLongName: 'LongName',
  isoTopicCategory: 'gmd:MD_TopicCategoryCode',
  isoTopicCategoryCodeListValue: 'gmd:MD_TopicCategoryCode/@codeListValue',
  productLevelId: 'gmd:code/gco:CharacterString',
  dataformat: 'gmd:MD_Format/gmd:name/gco:CharacterString'
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
