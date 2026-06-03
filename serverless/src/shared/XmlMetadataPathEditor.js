import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import xpath from 'xpath'

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'
const ELEMENT_NODE = 1

/**
 * Normalize optional text inputs so object comparisons and XML writes behave consistently.
 *
 * @example
 * trimString('  SPOT-4  ')
 * // 'SPOT-4'
 */
const trimString = (value) => ((typeof value === 'string') ? value.trim() : '')

/**
 * True when any field in a keyword-style object contains meaningful text.
 *
 * @example
 * hasAnyObjectValue({ Type: '', ShortName: 'SPOT-4' })
 * // true
 */
const hasAnyObjectValue = (keywordObject) => Object.values(keywordObject || {})
  .some((value) => trimString(value).length > 0)

/**
 * Resolves the most useful scalar representation of a keyword object for leaf/scalar updates.
 *
 * @example
 * getScalarKeywordText({ Value: 'OCEANS', ShortName: 'ignored' })
 * // 'OCEANS'
 */
const getScalarKeywordText = (keywordObject = {}) => {
  const preferredValue = [keywordObject.Value, keywordObject.ShortName]
    .map((value) => trimString(value))
    .find((value) => value.length > 0)

  if (preferredValue) {
    return preferredValue
  }

  return Object.values(keywordObject)
    .map((value) => trimString(value))
    .find((value) => value.length > 0) || ''
}

/**
 * Rewrites simple element XPath into a namespace-agnostic `local-name()` form.
 *
 * Live CMR DIF10 payloads use a default namespace, while several local fixtures do not. Our
 * scheme configs intentionally use simple unprefixed XPath like `//DIF/Science_Keywords`, so we
 * normalize all element-path lookups into a namespace-agnostic `local-name()` form up front.
 *
 * @example
 * toNamespaceAgnosticXPath('//DIF/Science_Keywords')
 * // '//*[local-name()=\"DIF\"]/*[local-name()=\"Science_Keywords\"]'
 */
const toNamespaceAgnosticXPath = (expression) => expression.replace(
  /(^|\/)([A-Za-z_][\w.-]*)(?=\/|$)/g,
  '$1*[local-name()="$2"]'
)

/**
 * Builds a `replace` mapping that reads ordered values from the normalized keyword object.
 *
 * @param {string[]} fieldPaths - Ordered XML field paths to write.
 * @param {string[]} [valueKeys=fieldPaths] - Ordered keyword-object keys to read from.
 * @returns {Array<{fieldPath: string, source: {type: 'value', key: string, valueKeys: string[]}}>}
 * Replace configuration entries for `updateBlockNode`.
 *
 * @example
 * const replace = sequentialValueReplace(
 *   ['Category', 'Topic', 'Term'],
 *   ['Category', 'Topic', 'Term']
 * )
 * // [
 * //   { fieldPath: 'Category', source: { type: 'value', key: 'Category', valueKeys: ['Category', 'Topic', 'Term'] } },
 * //   { fieldPath: 'Topic', source: { type: 'value', key: 'Topic', valueKeys: ['Category', 'Topic', 'Term'] } },
 * //   { fieldPath: 'Term', source: { type: 'value', key: 'Term', valueKeys: ['Category', 'Topic', 'Term'] } }
 * // ]
 */
export const sequentialValueReplace = (fieldPaths, valueKeys = fieldPaths) => fieldPaths.map(
  (fieldPath, index) => ({
    fieldPath,
    source: {
      type: 'value',
      key: valueKeys[index],
      valueKeys
    }
  })
)

/**
 * Generic XML editor for metadata formats whose controlled keyword content can be described as:
 * 1. an XPath to one or more candidate nodes
 * 2. a mapping between normalized keyword-object keys and XML field names
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
 *   oldKeywordObject: {
 *     ShortName: 'SPOT-4'
 *   },
 *   newKeywordObject: {
 *     Type: 'Earth Observation Satellites',
 *     ShortName: 'SPOT-4-UPDATED'
 *   }
 * }, {
 *   nodeXPath: '//DIF/Platform',
 *   find: {
 *     fieldPaths: ['Short_Name'],
 *     valueKeys: ['ShortName']
 *   },
 *   replace: [
 *     {
 *       fieldPath: 'Type',
 *       source: { type: 'value', key: 'Type' }
 *     },
 *     {
 *       fieldPath: 'Short_Name',
 *       source: { type: 'value', key: 'ShortName' }
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
   * // XmlMetadataPathEditor instance
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
   * // '<?xml version="1.0" encoding="UTF-8"?>\\n<DIF><Node>value</Node></DIF>'
   */
  serialize() {
    return `${XML_DECLARATION}\n${new XMLSerializer().serializeToString(this.document)}`
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
   * // [platformNode, platformNode]
   */
  selectNodes(expression, contextNode = this.document) {
    return xpath.select(toNamespaceAgnosticXPath(expression), contextNode)
      .filter((node) => node?.nodeType === ELEMENT_NODE)
  }

  /**
   * Returns only element children for the provided node.
   *
   * @param {Node|null|undefined} node Candidate parent node.
   * @returns {Element[]} Direct child elements.
   *
   * @example
   * const children = editor.getElementChildren(editor.selectNodes('/DIF')[0])
   * // [platformNode, locationNode]
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
   *
   * @example
   * const shortNameNode = editor.getDirectChildElement(platformNode, 'Short_Name')
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
   * const shortNameNode = editor.getNestedElement(platformNode, 'Organization_Name/Short_Name')
   * // shortNameNode
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
   *
   * @example
   * const text = editor.getElementText(shortNameNode)
   * // 'SPOT-4'
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
   * // 'SPOT-4'
   */
  getNestedText(node, fieldPath) {
    return this.getElementText(this.getNestedElement(node, fieldPath))
  }

  /**
   * Reads ordered field values from a candidate metadata node.
   *
   * @param {Node} node Candidate metadata node.
   * @param {string[]} fieldPaths Ordered XML field paths.
   * @returns {string[]} Segment values extracted from the node.
   *
   * @example
   * const values = editor.getNodeFieldValues(platformNode, [
   *   'Type',
   *   'Short_Name'
   * ])
   * // ['Earth Observation Satellites', 'SPOT-4']
   */
  getNodeFieldValues(node, fieldPaths) {
    return fieldPaths.map((fieldPath) => this.getNestedText(node, fieldPath))
  }

  /**
   * Builds a keyword-style object from ordered XML field paths on a node.
   *
   * @param {Node} node Candidate metadata node.
   * @param {string[]} fieldPaths Ordered XML field paths.
   * @param {string[]} valueKeys Ordered keyword-object keys.
   * @returns {Record<string, string>} Keyword-style object keyed by the provided value keys.
   *
   * @example
   * const keywordObject = editor.getNodeValueObject(platformNode, ['Type', 'Short_Name'], ['Type', 'ShortName'])
   * // { Type: 'Earth Observation Satellites', ShortName: 'SPOT-4' }
   */
  getNodeValueObject(node, fieldPaths, valueKeys) {
    return fieldPaths.reduce((keywordObject, fieldPath, index) => ({
      ...keywordObject,
      [valueKeys[index]]: this.getNestedText(node, fieldPath)
    }), {})
  }

  /**
   * Removes all existing children from an element before replacing its text content.
   *
   * @param {Node|null|undefined} node Target node.
   *
   * @example
   * editor.removeAllChildren(longNameNode)
   * // undefined
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
   * // longNameNode
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
   * // shortNameNode
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
   *
   * @example
   * editor.setElementText(shortNameNode, 'SPOT-4-UPDATED')
   * // undefined
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
   * // undefined
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
   * // undefined
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
   *
   * @example
   * editor.removeNode(shortNameNode)
   * // undefined
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
   *
   * @example
   * editor.removeNodeIfNoElementChildren(platformNode)
   * // undefined
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
   *   {
   *     newKeywordObject: {
   *       Type: 'Earth Observation Satellites',
   *       ShortName: 'SPOT-4-UPDATED'
   *     },
   *     newLongName: 'Systeme Observation de la Terre-4 Updated'
   *   },
   *   { type: 'param', key: 'newLongName' }
   * )
   * // 'Systeme Observation de la Terre-4 Updated'
   */
  getReplacementValue(correction, sourceConfig = {}) {
    if (sourceConfig.type === 'param') {
      return trimString(correction?.[sourceConfig.key])
    }

    if (sourceConfig.type === 'value') {
      return trimString(correction?.newKeywordObject?.[sourceConfig.key])
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
   *   oldKeywordObject: {
   *     Type: 'VIEW RELATED INFORMATION',
   *     Subtype: 'OpenSearch'
   *   }
   * }, {
   *   nodeXPath: '//DIF/Related_URL/URL_Content_Type',
   *   find: {
   *     fieldPaths: ['Type', 'Subtype'],
   *     valueKeys: ['Type', 'Subtype']
   *   }
   * })
   * // targetNode
   */
  resolveNodeByFind(correction, config) {
    const nodes = this.selectNodes(config.nodeXPath)
    if (nodes.length === 0) {
      return null
    }

    if (config.find) {
      const valueKeys = Array.isArray(config.find.valueKeys) && config.find.valueKeys.length > 0
        ? config.find.valueKeys
        : config.find.fieldPaths
      const findValueObject = valueKeys.reduce((keywordObject, valueKey) => ({
        ...keywordObject,
        [valueKey]: trimString(correction?.oldKeywordObject?.[valueKey])
      }), {})

      if (hasAnyObjectValue(findValueObject)) {
        const matchedNode = nodes.find((node) => {
          const nodeValueObject = this.getNodeValueObject(
            node,
            config.find.fieldPaths,
            valueKeys
          )

          if (!hasAnyObjectValue(nodeValueObject)) {
            return false
          }

          return valueKeys.every((valueKey) => (
            nodeValueObject[valueKey] === findValueObject[valueKey]
          ))
        })

        if (matchedNode) {
          return matchedNode
        }

        return null
      }
    }

    if (!config.find) {
      const findText = getScalarKeywordText(correction?.oldKeywordObject)
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
   *   oldKeywordObject: {
   *     ShortName: 'ALIENS'
   *   },
   *   newKeywordObject: {
   *     ShortName: 'ALIENS-UPDATED'
   *   },
   *   newLongName: 'Aliens in Antarctica Updated'
   * }, projectConfig)
   * // true
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
   *   oldKeywordObject: {
   *     Value: 'GEOSCIENTIFIC INFORMATION'
   *   },
   *   newKeywordObject: {
   *     Value: 'OCEANS'
   *   }
   * }, {
   *   nodeXPath: '//DIF/ISO_Topic_Category'
   * })
   * // true
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
      const value = getScalarKeywordText(correction?.newKeywordObject)
      this.setElementText(targetNode, value)

      return true
    }

    return false
  }

  /**
   * Applies a replace/delete correction to a single scalar XML field.
   *
   * Scalar fields are different from block and leaf updates: they do not locate a target by
   * `oldKeywordObject`. Instead, they operate on the single field selected by `nodeXPath`, or
   * create that field under the DIF root when `replace` is requested and the field is absent.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific mutation configuration.
   * @returns {boolean} `true` when the scalar field was changed.
   *
   * @example
   * editor.updateScalarNode({
   *   action: 'replace',
   *   newKeywordObject: {
   *     Value: '1A'
   *   }
   * }, {
   *   nodeXPath: '//DIF/Product_Level_Id',
   *   tagName: 'Product_Level_Id'
   * })
   * // true
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
      const value = getScalarKeywordText(correction?.newKeywordObject)
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
