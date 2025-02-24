import { XMLBuilder } from 'fast-xml-parser'

import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Generates and returns the capabilities of the KMS system in XML format.
 *
 * @async
 * @function getCapabilities
 * @returns {Object} An object containing the XML response body and headers.
 * @throws {Error} If there's an error during the XML generation process.
 */
export const getCapabilities = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()

  try {
    const capabilities = {
      capabilities: {
        ':@': { version: '0.5' },
        software: {
          version: { '#text': '3.1.0' },
          build: { '#text': 'KMS-24.4.8-5' }
        },
        documentation: { '#text': 'https://wiki.earthdata.nasa.gov/display/ED/KMS+User%27s+Guide' },
        termsOfUse: { '#text': 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf' },
        urls: {
          a: [
            {
              ':@': {
                name: 'get_status',
                href: '/status',
                params: 'format=[xml|html]',
                action: 'N/A'
              }
            },
            {
              ':@': {
                name: 'get_concept_fullpaths',
                href: '/concept_fullpaths/concept_uuid/{conceptId}',
                params: 'None',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concept',
                href: '/concept/{conceptId}[.{format}]',
                params: 'format=[rdf|xml|]&version={label}',
                action: 'GET, PUT, DELETE'
              }
            },
            {
              ':@': {
                name: 'get_concept_schemes',
                href: '/concept_schemes',
                params: 'version={label}',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concepts_by_scheme',
                href: '/concepts/concept_scheme/{conceptScheme}',
                params: 'format=[rdf|xml|json|csv]&version={label}&page_num=&page_size=',
                action: 'GET, POST'
              }
            },
            {
              ':@': {
                name: 'get_concepts_by_scheme_pattern',
                href: '/concepts/concept_scheme/{conceptScheme}/pattern/{pattern}',
                params: 'format=[rdf|xml]&version={label}',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concepts_all',
                href: '/concepts',
                params: 'format=[rdf|xml]&version={label}',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concepts_root',
                href: '/concepts/root',
                params: 'format=[rdf|xml]&version={label}',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concepts_by_pattern',
                href: '/concepts/pattern/{pattern}',
                params: 'format=[rdf|xml]&version={label}',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concept_by_short_name',
                href: '/concept/short_name/{short_name}',
                params: 'version=&scheme=',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concept_by_alt_label',
                href: '/concept/alt_label/{alt_label}',
                params: 'version=&scheme=',
                action: 'GET'
              }
            },
            {
              ':@': {
                name: 'get_concept_versions',
                href: '/concept_versions/version_type/{versionType}',
                params: 'None',
                action: 'GET'
              }
            }
          ]
        }
      }
    }

    const options = {
      attributesGroupName: ':@',
      textNodeName: '#text',
      ignoreAttributes: false,
      suppressEmptyNode: true,
      format: true
    }

    const builder = new XMLBuilder(options)
    const xmlContent = builder.build(capabilities)

    return {
      body: xmlContent,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/xml; charset=utf-8'
      }
    }
  } catch (error) {
    console.error(`Error retrieving concept, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getCapabilities
