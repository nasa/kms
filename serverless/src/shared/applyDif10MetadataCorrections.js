import { XMLBuilder, XMLParser } from 'fast-xml-parser'

import { applyChronoUnitCorrection } from './Dif10FieldsCorrection/applyChronoUnitCorrection'
import {
  applyHorizontalResolutionRangeCorrection
} from './Dif10FieldsCorrection/applyHorizontalResolutionRangeCorrection'
import { applyIdnnodeCorrection } from './Dif10FieldsCorrection/applyIdnNodeCorrection'
import { applyInstrumentCorrection } from './Dif10FieldsCorrection/applyInstrumentCorrection'
import {
  applyIsoTopicCategoryCorrection
} from './Dif10FieldsCorrection/applyIsoTopicCategoryCorrection'
import { applyLocationCorrection } from './Dif10FieldsCorrection/applyLocationCorrection'
import { applyPlatformCorrection } from './Dif10FieldsCorrection/applyPlatformCorrection'
import {
  applyProductLevelIdCorrection
} from './Dif10FieldsCorrection/applyProductLevelIdCorrection'
import { applyProjectCorrection } from './Dif10FieldsCorrection/applyProjectCorrection'
import { applyProviderCorrection } from './Dif10FieldsCorrection/applyProviderCorrection'
import { applyRuContentTypeCorrection } from './Dif10FieldsCorrection/applyRuContentTypeCorrection'
import {
  applyScienceKeywordCorrection
} from './Dif10FieldsCorrection/applyScienceKeywordCorrection'
import {
  applyTemporalResolutionRangeCorrection
} from './Dif10FieldsCorrection/applyTemporalResolutionRangeCorrection'
import {
  applyVerticalResolutionRangeCorrection
} from './Dif10FieldsCorrection/applyVerticalResolutionRangeCorrection'

/**
 * Configuration for the fast-xml-parser to transform DIF10 XML into a JavaScript Object.
 * Preserves attributes and trims whitespace to ensure data integrity during correction.
 */

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true
})

/**
 * Configuration for the fast-xml-parser to rebuild the DIF10 XML string.
 * Ensures consistent indentation and suppresses empty nodes to maintain valid metadata standards.
 */
const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '    ',
  suppressEmptyNode: true
})

/**
 * Mapping of UMM correction schemes to their respective delegate functions.
 * Each delegate is responsible for performing targeted mutations on the parsed XML object.
 * @type {Object.<string, Function>}
 */
const SCHEME_DELEGATES = {
  sciencekeywords: applyScienceKeywordCorrection,
  locations: applyLocationCorrection,
  platforms: applyPlatformCorrection,
  instruments: applyInstrumentCorrection,
  projects: applyProjectCorrection,
  chronounits: applyChronoUnitCorrection,
  rucontenttype: applyRuContentTypeCorrection,
  isotopiccategory: applyIsoTopicCategoryCorrection,
  providers: applyProviderCorrection,
  temporalresolutionrange: applyTemporalResolutionRangeCorrection,
  verticalresolutionrange: applyVerticalResolutionRangeCorrection,
  horizontalresolutionrange: applyHorizontalResolutionRangeCorrection,
  idnnode: applyIdnnodeCorrection,
  productlevelid: applyProductLevelIdCorrection
}

/**
 * Orchestrates metadata corrections for DIF10 records.
 * * This function parses a raw XML payload into a JavaScript object, iterates through a list
 * of requested corrections, and routes them to specific scheme delegates. Once all
 * modifications are complete, it rebuilds the XML string.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.metadataPayload - The raw DIF10 XML string to be corrected.
 * @param {Array<Object>} [params.corrections=[]] - An array of correction objects containing
 * the scheme, action, and new values.
 * @returns {Promise<Object>} An object containing the correction count, the final
 * corrected XML string, and the list of successfully applied corrections.
 */
export const applyDif10MetadataCorrections = async (params) => {
  const { metadataPayload, corrections = [] } = params

  // Safety check for empty payloads
  if (!metadataPayload) {
    return {
      correctionCount: 0,
      stubbed: true
    }
  }

  // Transform XML to a mutable JS object
  const initialParsedMetadata = xmlParser.parse(metadataPayload)

  /**
   * Iterate through the corrections list using a reduction.
   * Delegates receive a reference to the metadata object and modify it in place.
   */
  const { finalMetadata, applied } = await corrections.reduce(async (accPromise, correction) => {
    const acc = await accPromise
    const scheme = String(correction.scheme || '').toLowerCase()
    const delegate = SCHEME_DELEGATES[scheme]

    console.log('delegate:', delegate)

    if (delegate) {
      /**
       * Execute the specialized delegate for the given scheme.
       * Delegates return true if they successfully found and modified the target element.
       */
      const isUpdated = await delegate(acc.finalMetadata, correction)
      if (isUpdated) {
        acc.applied.push(correction)
      }
    }

    return acc
  }, Promise.resolve({
    finalMetadata: initialParsedMetadata,
    applied: []
  }))

  return {
    ...params,
    correctionCount: applied.length,
    // Reconstruct the XML payload with the standard UTF-8 declaration
    correctedMetadata: `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBuilder.build(finalMetadata)}`,
    correctionsApplied: applied,
    stubbed: false
  }
}

export default applyDif10MetadataCorrections
