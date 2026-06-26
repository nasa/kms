import xpath from 'xpath'

import XmlMetadataPathEditor from './XmlMetadataPathEditor'
import { extractNamespaces, trimString } from './XmlUtils'

/**
 * Subclass of XmlMetadataPathEditor specialized for ISO 19115 XML structure.
 */
export class Iso19115MetadataPathEditor extends XmlMetadataPathEditor {
  constructor(xmlString) {
    super(xmlString)
    // Get the root element
    const root = this.document.documentElement

    // Build the namespace map from the root's attributes
    const namespaces = extractNamespaces(root)

    // Store for use in XPath resolution
    this.namespaces = namespaces
    const resolver = xpath.useNamespaces(namespaces)
    this.resolver = resolver
  }

  // In Iso19115Editor class
  selectNodes(expression, contextNode = this.document) {
  // Use the registered resolver instance
    return this.resolver(expression, contextNode)
      .filter((node) => node?.nodeType === 1) // ELEMENT_NODE
  }

  /**
   * Updates leaf (direct) nodes like isotopiccategory and productlevelid.
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
          // Use 'else if' to flatten the structure and satisfy the linter
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

  updateBlockNode(correction, config) {
    // 1. Find the parent block using your namespaced XPath
    const targetNode = this.selectNodes(config.nodeXPath)[0] || null
    if (!targetNode) return false

    // 2. Handle the 'delete' action
    // 2. Handle the 'delete' action
    if (correction.action === 'delete') {
      // 1. Get all potential keyword nodes within the block
      const keywordNodes = this.selectNodes('./gmd:keyword', targetNode)

      // 2. Find the correct node using your config's getNodeValueObject
      const matchingNode = keywordNodes.find((node) => {
        const parsedObject = config.find.getNodeValueObject({
          node,
          editor: this,
          fieldPaths: config.find.fieldPaths
        })

        return Object.keys(correction.oldKeywordObject).every((key) => {
          const parsedValue = parsedObject[key] ? trimString(parsedObject[key]).toLowerCase() : ''
          const correctionValue = correction.oldKeywordObject[key] ? trimString(correction.oldKeywordObject[key]).toLowerCase() : ''

          return parsedValue === correctionValue
        })
      })

      if (!matchingNode) return false

      // 3. Remove the identified node
      matchingNode.parentNode.removeChild(matchingNode)

      // 4. Cleanup empty parent blocks (same logic as before)
      const remainingKeywords = this.selectNodes('./gmd:keyword', targetNode)
      if (remainingKeywords.length === 0) {
        const mdKeywordsParent = targetNode.parentNode
        mdKeywordsParent.removeChild(targetNode)

        const remainingBlocks = this.selectNodes('./gmd:MD_Keywords', mdKeywordsParent)
        if (remainingBlocks.length === 0) {
          mdKeywordsParent.parentNode.removeChild(mdKeywordsParent)
        }
      }

      return true
    }

    // 3. Handle the 'replace' action
    if (correction.action === 'replace') {
      const replaceConfig = config.replace[0]

      // 1. Get all keyword nodes in this block
      const keywordNodes = this.selectNodes('./gmd:keyword', targetNode)

      const matchingNode = keywordNodes.find((node) => {
        const parsedObject = config.find.getNodeValueObject({
          node,
          editor: this,
          fieldPaths: config.find.fieldPaths
        })

        // Compare ALL keys present in the correction.oldKeywordObject
        // This works for { Value: '...' } AND { ShortName: '...' }
        return Object.keys(correction.oldKeywordObject).every((key) => {
          const parsedValue = parsedObject[key] ? trimString(parsedObject[key]).toLowerCase() : ''
          const correctionValue = correction.oldKeywordObject[key] ? trimString(correction.oldKeywordObject[key]).toLowerCase() : ''

          return parsedValue === correctionValue
        })
      })

      // Inside Iso19115MetadataPathEditor.js, within the 'replace' action block:
      if (matchingNode) {
        let fieldNode = null

        // 1. Attempt to find the dynamic path if defined in the config
        if (replaceConfig.fieldPath) {
          const path = typeof replaceConfig.fieldPath === 'function'
            ? replaceConfig.fieldPath({
              node: matchingNode,
              editor: this
            })
            : replaceConfig.fieldPath

          const relativePath = path.startsWith('./') ? path : `./${path}`;
          // Use destructuring to capture the first match directly
          [fieldNode] = this.selectNodes(relativePath, matchingNode)
        }

        // 2. Fallback: If dynamic path failed, look for standard gco:CharacterString
        if (!fieldNode) {
          [fieldNode] = this.selectNodes('./gco:CharacterString', matchingNode)
                    || this.selectNodes('gco:CharacterString', matchingNode)
        }

        // 3. Perform update if node found
        if (fieldNode) {
          const newValue = replaceConfig.source.getValue({ correction })
          this.setElementText(fieldNode, newValue)

          return true
        }
      }

      return false // Match not found or fieldNode missing
    }

    return false
  }
}
export default Iso19115MetadataPathEditor
