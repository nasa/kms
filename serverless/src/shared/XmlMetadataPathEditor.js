import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import xpath from 'xpath'

import { splitKeywordPath } from './splitKeywordPath'

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'
const ELEMENT_NODE = 1

// Normalize optional text inputs so path comparisons and XML writes behave consistently.
const trimString = (value) => ((typeof value === 'string') ? value.trim() : '')

// Treat omitted trailing path levels as intentionally blank when a scheme expects more slots.
const padSegments = (segments, expectedLength) => {
  if (!Number.isInteger(expectedLength) || expectedLength <= segments.length) {
    return segments
  }

  return segments.concat(Array(expectedLength - segments.length).fill(''))
}

// Ignore fully empty path selections when deciding whether a find rule is usable.
const hasAnyValue = (segments) => segments.some((segment) => trimString(segment).length > 0)

/**
 * Builds a one-to-one replacement mapping between ordered KMS path slots and XML field paths.
 *
 * This is the common case for hierarchical keyword schemes where the XML fields and the
 * `newKeywordPath` segments line up in the same order.
 *
 * @param {string[]} fieldPaths Ordered XML field paths to populate.
 * @returns {Array<{fieldPath: string, source: {type: 'path', pathIndex: number}}>} Replace config entries.
 *
 * @example
 * sequentialReplace(['Category', 'Topic', 'Term'])
 * // [
 * //   { fieldPath: 'Category', source: { type: 'path', pathIndex: 0 } },
 * //   { fieldPath: 'Topic', source: { type: 'path', pathIndex: 1 } },
 * //   { fieldPath: 'Term', source: { type: 'path', pathIndex: 2 } }
 * // ]
 */
export const sequentialReplace = (fieldPaths) => fieldPaths.map((fieldPath, pathIndex) => ({
  fieldPath,
  source: {
    type: 'path',
    pathIndex
  }
}))

/**
 * Generic XML editor for metadata formats whose controlled keyword content can be described as:
 * 1. an XPath to one or more candidate nodes
 * 2. a mapping between KMS `>`-delimited path segments and XML field names
 * 3. a delete/replace strategy for the matched node
 *
 * DIF10 is the first consumer, but the core editor stays format-agnostic so ECHO10 / ISO-style
 * delegates can reuse the same matching and mutation primitives.
 *
 * @example
 * const editor = new XmlMetadataPathEditor(`
 *   <DIF>
 *     <Platform>
 *       <Type>Earth Observation Satellites</Type>
 *       <Short_Name>SPOT-4</Short_Name>
 *     </Platform>
 *   </DIF>
 * `)
 *
 * editor.updateBlockNode({
 *   action: 'replace',
 *   oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4',
 *   newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4-UPDATED'
 * }, {
 *   nodeXPath: '//DIF/Platform',
 *   find: {
 *     fieldPaths: ['Short_Name'],
 *     takeLastSegments: 1
 *   },
 *   replace: [
 *     {
 *       fieldPath: 'Type',
 *       source: { type: 'path', pathIndex: 1 }
 *     },
 *     {
 *       fieldPath: 'Short_Name',
 *       source: { type: 'path', pathIndex: 3 }
 *     }
 *   ]
 * })
 *
 * const updatedXml = editor.serialize()
 */
export class XmlMetadataPathEditor {
  /**
   * Builds a DOM-backed editor around a raw XML metadata payload.
   *
   * @param {string} xmlString Raw XML metadata payload.
   *
   * @example
   * const editor = new XmlMetadataPathEditor('<DIF><Entry_ID/></DIF>')
   */
  constructor(xmlString) {
    this.document = new DOMParser().parseFromString(xmlString, 'text/xml')
  }

  /**
   * Serializes the current DOM back to an XML string with the standard declaration.
   *
   * @returns {string} Updated XML payload.
   *
   * @example
   * const editor = new XmlMetadataPathEditor('<DIF><Node>value</Node></DIF>')
   * const xml = editor.serialize()
   */
  serialize() {
    return `${XML_DECLARATION}\n${new XMLSerializer().serializeToString(this.document)}`
  }

  /**
   * Splits a KMS keyword path into normalized `>`-delimited segments.
   *
   * @param {string} keywordPath Raw KMS keyword path.
   * @returns {string[]} Normalized path segments.
   *
   * @example
   * XmlMetadataPathEditor.normalizePathSegments('EARTH SCIENCE >  > AEROSOLS')
   * // ['EARTH SCIENCE', '', 'AEROSOLS']
   *
   * @example
   * XmlMetadataPathEditor.normalizePathSegments('A >  > C')
   * // ['A', '', 'C']
   */
  static normalizePathSegments(keywordPath) {
    return splitKeywordPath(typeof keywordPath === 'string' ? keywordPath : '')
      .map((segment) => trimString(segment))
  }

  /**
   * Extracts the path segments that should participate in a node find rule.
   *
   * @param {string} keywordPath Raw KMS keyword path.
   * @param {Object} [findConfig={}] Find selection rules.
   * @param {string[]} [findConfig.fieldPaths] Ordered XML fields that define a full hierarchy.
   * @param {number[]} [findConfig.segmentPositions] Specific segment positions to compare.
   * @param {number} [findConfig.takeLastSegments] Number of trailing segments to compare.
   * @returns {string[]|null} Selected path segments or `null` when no usable value exists.
   *
   * @example
   * XmlMetadataPathEditor.getPathSegmentsForFind(
   *   'Space-based Platforms > Earth Observation Satellites >  > SPOT-4',
   *   { takeLastSegments: 1 }
   * )
   * // ['SPOT-4']
   *
   * @example
   * XmlMetadataPathEditor.getPathSegmentsForFind(
   *   'DistributionURL > VIEW RELATED INFORMATION > OpenSearch',
   *   { takeLastSegments: 2 }
   * )
   * // ['VIEW RELATED INFORMATION', 'OpenSearch']
   */
  static getPathSegmentsForFind(keywordPath, findConfig = {}) {
    if (!findConfig) return null

    const {
      fieldPaths,
      segmentPositions,
      takeLastSegments
    } = findConfig

    let segments = XmlMetadataPathEditor.normalizePathSegments(keywordPath)

    if (Array.isArray(segmentPositions)) {
      segments = padSegments(segments, Math.max(...segmentPositions) + 1)
      segments = segmentPositions.map((segmentPosition) => segments[segmentPosition] || '')
    } else if (
      Array.isArray(fieldPaths)
      && fieldPaths.length > 0
      && typeof takeLastSegments !== 'number'
    ) {
      segments = padSegments(segments, fieldPaths.length)
    } else if (typeof takeLastSegments === 'number') {
      segments = segments.slice(-takeLastSegments)
    }

    return hasAnyValue(segments) ? segments : null
  }

  /**
   * Selects element nodes matching an XPath expression.
   *
   * @param {string} expression XPath expression to evaluate.
   * @param {Node} [contextNode=this.document] Context node for the XPath query.
   * @returns {Element[]} Matching element nodes.
   *
   * @example
   * const editor = new XmlMetadataPathEditor('<DIF><Platform/><Platform/></DIF>')
   * const platforms = editor.selectNodes('//DIF/Platform')
   */
  selectNodes(expression, contextNode = this.document) {
    return xpath.select(expression, contextNode)
      .filter((node) => node?.nodeType === ELEMENT_NODE)
  }

  /**
   * Returns only element children for the provided node.
   *
   * @param {Node|null|undefined} node Candidate parent node.
   * @returns {Element[]} Direct child elements.
   */
  getElementChildren(node) {
    return Array.from(node?.childNodes || [])
      .filter((child) => child.nodeType === ELEMENT_NODE)
  }

  /**
   * Finds a direct child element by tag name.
   *
   * @param {Node|null|undefined} node Candidate parent node.
   * @param {string} tagName Tag name to match.
   * @returns {Element|null} Matching direct child element, if present.
   */
  getDirectChildElement(node, tagName) {
    return this.getElementChildren(node)
      .find((child) => child.nodeName === tagName) || null
  }

  /**
   * Traverses a slash-delimited field path beneath the provided node.
   *
   * @param {Node|null|undefined} node Starting node.
   * @param {string} fieldPath Slash-delimited child path.
   * @returns {Element|null} Matching nested element, if present.
   *
   * @example
   * const shortName = editor.getNestedElement(platformNode, 'Organization_Name/Short_Name')
   */
  getNestedElement(node, fieldPath) {
    return fieldPath
      .split('/')
      .reduce((currentNode, tagName) => (
        currentNode ? this.getDirectChildElement(currentNode, tagName) : null
      ), node)
  }

  /**
   * Reads trimmed text content from an element.
   *
   * @param {Node|null|undefined} node Candidate text node owner.
   * @returns {string} Trimmed text content.
   */
  getElementText(node) {
    return trimString(node?.textContent)
  }

  /**
   * Reads trimmed text from a nested element path.
   *
   * @param {Node|null|undefined} node Starting node.
   * @param {string} fieldPath Slash-delimited child path.
   * @returns {string} Trimmed nested text content.
   *
   * @example
   * const shortName = editor.getNestedText(platformNode, 'Short_Name')
   */
  getNestedText(node, fieldPath) {
    return this.getElementText(this.getNestedElement(node, fieldPath))
  }

  /**
   * Builds a keyword-style segment array from the configured fields on a node.
   *
   * @param {Node} node Candidate metadata node.
   * @param {string[]} fieldPaths Ordered XML field paths.
   * @returns {string[]} Segment values extracted from the node.
   *
   * @example
   * const segments = editor.getNodePathSegments(platformNode, [
   *   'Type',
   *   'Short_Name'
   * ])
   * // ['Earth Observation Satellites', 'SPOT-4']
   */
  getNodePathSegments(node, fieldPaths) {
    return fieldPaths.map((fieldPath) => this.getNestedText(node, fieldPath))
  }

  /**
   * Removes all existing children from an element before replacing its text content.
   *
   * @param {Node|null|undefined} node Target node.
   */
  removeAllChildren(node) {
    while (node?.firstChild) {
      node.removeChild(node.firstChild)
    }
  }

  /**
   * Returns an existing direct child element or creates one when absent.
   *
   * @param {Element} node Parent element.
   * @param {string} tagName Direct child tag name.
   * @returns {Element} Existing or newly created child element.
   *
   * @example
   * const longNameNode = editor.ensureDirectChildElement(platformNode, 'Long_Name')
   */
  ensureDirectChildElement(node, tagName) {
    const existingChild = this.getDirectChildElement(node, tagName)
    if (existingChild) {
      return existingChild
    }

    const child = node.ownerDocument.createElement(tagName)
    node.appendChild(child)

    return child
  }

  /**
   * Ensures a slash-delimited nested element path exists.
   *
   * @param {Element} node Starting element.
   * @param {string} fieldPath Slash-delimited child path.
   * @returns {Element} Terminal element for the requested path.
   *
   * @example
   * const shortNameNode = editor.ensureNestedElement(
   *   organizationNode,
   *   'Organization_Name/Short_Name'
   * )
   */
  ensureNestedElement(node, fieldPath) {
    return fieldPath
      .split('/')
      .reduce((currentNode, tagName) => this.ensureDirectChildElement(currentNode, tagName), node)
  }

  /**
   * Replaces an element's children with a single text node.
   *
   * @param {Element} node Target element.
   * @param {string} value Replacement text value.
   */
  setElementText(node, value) {
    this.removeAllChildren(node)
    node.appendChild(node.ownerDocument.createTextNode(value))
  }

  /**
   * Writes a text value to a nested child path, creating any missing elements.
   *
   * @param {Element} node Starting element.
   * @param {string} fieldPath Slash-delimited child path.
   * @param {string} value Replacement text value.
   *
   * @example
   * editor.setNestedText(platformNode, 'Long_Name', 'Systeme Observation de la Terre-4')
   */
  setNestedText(node, fieldPath, value) {
    const target = this.ensureNestedElement(node, fieldPath)
    this.setElementText(target, value)
  }

  /**
   * Removes a nested child element when it exists.
   *
   * @param {Element} node Starting element.
   * @param {string} fieldPath Slash-delimited child path.
   *
   * @example
   * editor.removeNestedElement(relatedUrlNode, 'URL_Content_Type/Subtype')
   */
  removeNestedElement(node, fieldPath) {
    const pathParts = fieldPath.split('/')
    const childTagName = pathParts.pop()
    const parentNode = pathParts.length > 0 ? this.getNestedElement(node, pathParts.join('/')) : node
    const childNode = parentNode ? this.getDirectChildElement(parentNode, childTagName) : null

    if (childNode?.parentNode) {
      childNode.parentNode.removeChild(childNode)
    }
  }

  /**
   * Removes a node from its parent when possible.
   *
   * @param {Node|null|undefined} node Target node.
   */
  removeNode(node) {
    if (node?.parentNode) {
      node.parentNode.removeChild(node)
    }
  }

  /**
   * Removes a node only when it no longer contains any child elements.
   *
   * @param {Element|null|undefined} node Candidate container node.
   */
  removeNodeIfNoElementChildren(node) {
    if (node && this.getElementChildren(node).length === 0) {
      this.removeNode(node)
    }
  }

  /**
   * Resolves the replacement value for a configured XML field from correction input.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} [sourceConfig={}] Source selection rules for the replacement value.
   * @returns {string} Replacement value to write into the XML field.
   *
   * @example
   * editor.getReplacementValue(
   *   { newKeywordPath: 'A > B > C' },
   *   { type: 'path', pathIndex: 1 }
   * )
   * // 'B'
   *
   * @example
   * editor.getReplacementValue(
   *   {
   *     scheme: 'platforms',
   *     action: 'replace',
   *     oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4',
   *     newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4-UPDATED',
   *     newLongName: 'Systeme Observation de la Terre-4 Updated'
   *   },
   *   { type: 'param', key: 'newLongName' }
   * )
   * // 'Systeme Observation de la Terre-4 Updated'
   */
  getReplacementValue(correction, sourceConfig = {}) {
    if (sourceConfig.type === 'param') {
      return trimString(correction[sourceConfig.key])
    }

    let segments = XmlMetadataPathEditor.normalizePathSegments(correction.newKeywordPath)

    if (typeof sourceConfig.takeLastSegments === 'number') {
      segments = segments.slice(-sourceConfig.takeLastSegments)
    }

    if (sourceConfig.pathIndex === 'last') {
      return trimString(segments[segments.length - 1] || '')
    }

    if (typeof sourceConfig.pathIndex === 'number') {
      return trimString(segments[sourceConfig.pathIndex] || '')
    }

    return ''
  }

  /**
   * Locates the XML node that corresponds to the current keyword value being corrected.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific node find configuration.
   * @returns {Element|null} Matching XML node or `null` when no current value matches.
   *
   * @example
   * const targetNode = editor.resolveNodeByFind({
   *   oldKeywordPath: 'DistributionURL > VIEW RELATED INFORMATION > OpenSearch'
   * }, {
   *   nodeXPath: '//DIF/Related_URL/URL_Content_Type',
   *   find: {
   *     fieldPaths: ['Type', 'Subtype'],
   *     takeLastSegments: 2
   *   }
   * })
   */
  resolveNodeByFind(correction, config) {
    const nodes = this.selectNodes(config.nodeXPath)
    if (nodes.length === 0) {
      return null
    }

    if (config.find) {
      const findSegments = XmlMetadataPathEditor.getPathSegmentsForFind(
        correction.oldKeywordPath,
        config.find
      )

      if (findSegments) {
        const matchedNode = nodes.find((node) => {
          const nodeSegments = this.getNodePathSegments(node, config.find.fieldPaths)

          if (!hasAnyValue(nodeSegments)) {
            return false
          }

          return nodeSegments.join(' > ') === findSegments.join(' > ')
        })

        if (matchedNode) {
          return matchedNode
        }

        return null
      }
    }

    if (!config.find) {
      const findText = trimString(correction.oldKeywordPath)
      if (findText.length > 0) {
        const matchedNode = nodes.find((node) => this.getElementText(node) === findText)

        if (matchedNode) {
          return matchedNode
        }

        return null
      }
    }

    return null
  }

  /**
   * Applies a replace/delete correction to a repeated block-style XML node.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific mutation configuration.
   * @returns {boolean} `true` when a node was matched and changed.
   *
   * @example
   * editor.updateBlockNode({
   *   action: 'replace',
   *   oldKeywordPath: 'A - C > ALIENS',
   *   newKeywordPath: 'A - C > ALIENS-UPDATED',
   *   newLongName: 'Aliens in Antarctica Updated'
   * }, projectConfig)
   */
  updateBlockNode(correction, config) {
    const action = trimString(String(correction.action || 'replace')).toLowerCase()
    const targetNode = this.resolveNodeByFind(correction, config)
    if (!targetNode) {
      return false
    }

    if (action === 'delete') {
      this.removeNode(targetNode)

      if (typeof config.afterDelete === 'function') {
        config.afterDelete(this, targetNode)
      }

      return true
    }

    if (action === 'replace') {
      config.replace.forEach(({ fieldPath, source }) => {
        const value = this.getReplacementValue(correction, source)

        if (value.length > 0) {
          this.setNestedText(targetNode, fieldPath, value)
        } else {
          this.removeNestedElement(targetNode, fieldPath)
        }
      })

      if (
        config.removeNodeIfEmptyAfterReplace
        && this.getElementChildren(targetNode).length === 0
      ) {
        this.removeNode(targetNode)
      }

      if (typeof config.afterReplace === 'function') {
        config.afterReplace(this, targetNode)
      }

      return true
    }

    return false
  }

  /**
   * Applies a replace/delete correction to a simple leaf XML node.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific mutation configuration.
   * @returns {boolean} `true` when a node was matched and changed.
   *
   * @example
   * editor.updateLeafNode({
   *   action: 'replace',
   *   oldKeywordPath: 'GEOSCIENTIFIC INFORMATION',
   *   newKeywordPath: 'OCEANS'
   * }, {
   *   nodeXPath: '//DIF/ISO_Topic_Category'
   * })
   */
  updateLeafNode(correction, config) {
    const action = trimString(String(correction.action || 'replace')).toLowerCase()
    const targetNode = this.resolveNodeByFind(correction, config)
    if (!targetNode) {
      return false
    }

    if (action === 'delete') {
      const { parentNode } = targetNode
      this.removeNode(targetNode)

      if (config.removeEmptyParent) {
        this.removeNodeIfNoElementChildren(parentNode)
      }

      return true
    }

    if (action === 'replace') {
      this.setElementText(targetNode, typeof correction.newKeywordPath === 'string' ? correction.newKeywordPath : '')

      return true
    }

    return false
  }

  /**
   * Applies a replace/delete correction to a single scalar XML field.
   *
   * Scalar fields are different from block and leaf updates: they do not locate a target by
   * `oldKeywordPath`. Instead, they operate on the single field selected by `nodeXPath`, or
   * create that field under the DIF root when `replace` is requested and the field is absent.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific mutation configuration.
   * @returns {boolean} `true` when the scalar field was changed.
   *
   * @example
   * editor.updateScalarNode({
   *   action: 'replace',
   *   newKeywordPath: '1A'
   * }, {
   *   nodeXPath: '//DIF/Product_Level_Id',
   *   tagName: 'Product_Level_Id'
   * })
   */
  updateScalarNode(correction, config) {
    const action = trimString(String(correction.action || 'replace')).toLowerCase()
    const targetNode = this.selectNodes(config.nodeXPath)[0] || null

    if (action === 'delete') {
      if (!targetNode) {
        return false
      }

      this.removeNode(targetNode)

      return true
    }

    if (action === 'replace') {
      const value = trimString(correction.newKeywordPath)
      if (value.length === 0) {
        return false
      }

      if (targetNode) {
        this.setElementText(targetNode, value)
      } else {
        const difNode = this.selectNodes('/DIF')[0]
        if (!difNode) {
          return false
        }

        const newNode = this.document.createElement(config.tagName)
        this.setElementText(newNode, value)
        difNode.appendChild(newNode)
      }

      return true
    }

    return false
  }
}

export default XmlMetadataPathEditor
