import xpath from 'xpath'

import XmlMetadataPathEditor from './XmlMetadataPathEditor'
import { extractNamespaces } from './XmlUtils'

/**
 * Subclass of XmlMetadataPathEditor specialized for ISO 19115 XML structure.
 * Handles namespace resolution and provides specific methods for updating
 * keyword blocks and leaf nodes within ISO 19115 metadata.
 */
export class Iso19115MetadataPathEditor extends XmlMetadataPathEditor {
  constructor(xmlString) {
    super(xmlString)
    const root = this.document.documentElement

    // 1. Get dynamic namespaces
    const extracted = extractNamespaces(root)

    // 2. Define standard ISO 19115 namespaces
    const standardNamespaces = {
      gco: 'http://www.isotc211.org/2005/gco',
      gmd: 'http://www.isotc211.org/2005/gmd',
      gmi: 'http://www.isotc211.org/2005/gmi',
      gmx: 'http://www.isotc211.org/2005/gmx',
      gml: 'http://www.opengis.net/gml/3.2'
    }

    // 3. Merge them, prioritizing extracted ones (if any)
    this.namespaces = {
      ...standardNamespaces,
      ...extracted
    }

    this.resolver = xpath.useNamespaces(this.namespaces)
  }

  /**
   * Executes an XPath expression and ensures only element nodes are returned.
   * @param {string} expression - The XPath string.
   * @param {Node} contextNode - The XML node to execute the search against.
   * @returns {Node[]} Array of matching Element nodes.
   */
  selectNodes(expression, contextNode = this.document) {
    return this.resolver(expression, contextNode)
      .filter((node) => node?.nodeType === 1) // Ensure only ELEMENT_NODE
  }

  /**
   * Identifies the specific keyword node to update or delete within a block.
   * @param {Node} targetNode - The parent MD_Keywords block.
   * @param {Object} correction - The user-provided change data.
   * @param {Object} config - The configuration defining matching logic.
   * @returns {Node|undefined} The matching node if found.
   */
  findMatchingNode(targetNode, correction, config) {
    const keywordNodes = this.selectNodes('./gmd:keyword', targetNode)

    return keywordNodes.find((node) => {
      const parsedObject = config.find.getNodeValueObject({
        node,
        editor: this,
        fieldPaths: config.find.fieldPaths
      })

      // Use defined matchKeys or default to existing object keys
      const matchKeys = config.find.matchKeys || Object.keys(correction.oldKeywordObject)

      return matchKeys.every((key) => {
        const parsedValue = (parsedObject[key] || '').toLowerCase().trim()
        const correctionValue = (correction.oldKeywordObject[key] || '').toLowerCase().trim()

        return parsedValue === correctionValue
      })
    })
  }

  /**
   * Updates or deletes leaf nodes (direct elements) based on configuration.
   * Handles multi-step path deletions and attribute-based updates.
   * @param {Object} correction - The change data.
   * @param {Object} config - The node configuration mapping.
   * @returns {boolean} True if the operation was successful.
   */
  updateLeafNode(correction, config) {
    const { action, oldKeywordObject } = correction
    const oldVal = (oldKeywordObject.Value || '').toLowerCase().trim()
    const allNodes = this.selectNodes(config.nodeXPath)

    if (action === 'delete') {
      // 1. Find the primary node to confirm the object exists
      const targetNode = allNodes.find((node) => {
        const valueObj = config.find.getNodeValueObject({
          node,
          editor: this
        })

        const foundVal = (valueObj.Value || '').toLowerCase().trim()
        const match = foundVal === oldVal

        return match
      })

      if (targetNode) {
        // 2. Strategy: If explicit delete paths are provided, use them (e.g., productlevelid)
        if (config.delete && config.delete.length > 0) {
          config.delete.forEach((delConfig) => {
            const nodesToDelete = this.selectNodes(delConfig.path, this.document)
            nodesToDelete.forEach((node) => {
              if (node && node.parentNode) {
                node.parentNode.removeChild(node)
              }
            })
          })
        } else if (targetNode.parentNode) {
          targetNode.parentNode.removeChild(targetNode)
        }

        return true
      }

      return false
    }

    if (action === 'replace') {
      const matchingNode = allNodes.find((node) => {
        const valueObj = config.find.getNodeValueObject({
          node,
          editor: this
        })

        return (valueObj.Value || '').toLowerCase().trim() === oldVal
      })

      if (matchingNode) {
        config.replace.forEach((replConfig) => {
          const newValue = replConfig.source.getValue({ correction })
          const isGlobal = replConfig.fieldPath.startsWith('//')
          const context = isGlobal ? this.document : matchingNode

          // If updating an attribute (contains @)
          if (replConfig.fieldPath.includes('@')) {
            const [path, attr] = replConfig.fieldPath.split('/@')
            const targetElement = this.selectNodes(isGlobal ? path : `./${path}`, context)[0]
            if (targetElement) targetElement.setAttribute(attr, newValue)
          } else {
            // Standard text content update
            const targetNode = this.selectNodes(isGlobal ? replConfig.fieldPath : `./${replConfig.fieldPath}`, context)[0]
            if (targetNode) this.setElementText(targetNode, newValue)
          }
        })

        return true
      }
    }

    return false
  }

  /**
   * Updates complex keyword block nodes.
   * Handles deletion and replacement of keywords, including synchronized
   * updates across global paths (like CI_ResponsibleParty).
   * @param {Object} correction - The change data.
   * @param {Object} config - Configuration for the block node.
   * @returns {boolean} True if the operation was successful.
   */
  updateBlockNode(correction, config) {
    const targetNodes = this.selectNodes(config.nodeXPath)
    if (!targetNodes || targetNodes.length === 0) return false

    // Identify the first block that contains the matching node
    const matchingData = targetNodes
      .map((node) => ({
        node,
        matchingNode: this.findMatchingNode(node, correction, config)
      }))
      .find((data) => data.matchingNode !== null)

    // Return early if no match is found, preventing downstream errors
    if (!matchingData) return false

    const { matchingNode } = matchingData

    // 2. Handle 'delete' action
    if (correction.action === 'delete') {
      const parentBlock = matchingNode.parentNode

      // Clean up synchronized paths globally first
      if (config.replace) {
        config.replace
          .filter((replConfig) => typeof replConfig.fieldPath === 'string' && replConfig.fieldPath.startsWith('//'))
          .forEach((replConfig) => {
            this.selectNodes(replConfig.fieldPath, this.document)
              .forEach((node) => node?.parentNode?.removeChild(node))
          })
      }

      // Remove the target keyword
      matchingNode.parentNode.removeChild(matchingNode)

      // Cleanup parent blocks if empty
      if (this.selectNodes('./gmd:keyword', parentBlock).length === 0) {
        const mdKeywordsParent = parentBlock.parentNode
        mdKeywordsParent.removeChild(parentBlock)

        if (this.selectNodes('./gmd:MD_Keywords', mdKeywordsParent).length === 0) {
          mdKeywordsParent.parentNode.removeChild(mdKeywordsParent)
        }
      }

      return true
    }

    // 3. Handle 'replace' action
    if (correction.action === 'replace') {
      const results = config.replace.map((replaceConfig) => {
        let fieldNode = null

        if (replaceConfig.fieldPath) {
          const path = typeof replaceConfig.fieldPath === 'function'
            ? replaceConfig.fieldPath({
              node: matchingNode,
              editor: this
            })
            : replaceConfig.fieldPath

          const context = path.startsWith('//') ? this.document : matchingNode
          const relativePath = path.startsWith('//') ? path : `./${path}`;
          [fieldNode] = this.selectNodes(relativePath, context)
        }

        if (!fieldNode) {
          [fieldNode] = this.selectNodes('./gco:CharacterString', matchingNode)
        }

        if (fieldNode) {
          this.setElementText(fieldNode, replaceConfig.source.getValue({ correction }))

          return true
        }

        return false
      })

      return results.some((success) => success === true)
    }

    // If action is neither 'delete' nor 'replace'
    return false
  }
}
export default Iso19115MetadataPathEditor
