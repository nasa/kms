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
   * Updates leaf (direct) nodes like isotopiccategory.
   */
  updateLeafNode(correction, config) {
    const { action, oldKeywordObject } = correction
    const oldVal = (oldKeywordObject.Value || '').toLowerCase().trim()

    // 1. Get all relevant nodes
    const allNodes = this.selectNodes(config.nodeXPath)

    // 2. Handle DELETE
    if (action === 'delete') {
      const targetNode = allNodes.find((node) => (node.textContent || '').toLowerCase().trim() === oldVal)
      if (targetNode) {
        targetNode.parentNode.removeChild(targetNode)

        return true
      }

      return false
    }

    // 3. Handle REPLACE
    if (action === 'replace') {
      const matchingNode = allNodes.find((node) => (node.textContent || '').toLowerCase().trim() === oldVal)

      if (matchingNode) {
        // We iterate through the replace config array using the correction object
        config.replace.forEach((replConfig) => {
          // The source.getValue function uses the 'correction' object (which contains newKeywordObject)
          const newValue = replConfig.source.getValue({ correction })

          if (replConfig.fieldPath.includes('@')) {
            const [elementName, attrName] = replConfig.fieldPath.split('/@')
            const targetElement = this.selectNodes(`./${elementName}`, matchingNode)[0]
            if (targetElement) {
              targetElement.setAttribute(attrName, newValue)
            }
          } else {
            const fieldNode = this.selectNodes(`./${replConfig.fieldPath}`, matchingNode)[0]
            if (fieldNode) {
              this.setElementText(fieldNode, newValue)
            }
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
    if (correction.action === 'delete') {
      // Normalize search string to lowercase
      const oldVal = (correction.oldKeywordObject.Value || correction.oldKeywordObject.ShortName || '').toLowerCase().trim()

      // 1. Get all potential CharacterString nodes within the block
      const allCharStrings = this.selectNodes('.//gmd:keyword/gco:CharacterString', targetNode)

      // 2. Find the node using a case-insensitive partial match (.includes)
      const targetCharString = allCharStrings.find((node) => {
        const textValue = (node.textContent || '').toLowerCase().trim()

        return textValue.includes(oldVal)
      })

      if (!targetCharString) return false

      // 3. Remove the specific keyword entry
      const keywordNode = targetCharString.parentNode
      keywordNode.parentNode.removeChild(keywordNode)

      // 4. Check if any keywords remain in the MD_Keywords block
      const remainingKeywords = this.selectNodes('.//gmd:keyword', targetNode)

      if (remainingKeywords.length === 0) {
        // ... (rest of your cleanup logic remains exactly the same)
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

      if (matchingNode) {
        // Since matchingNode is already the <gmd:keyword> element,
        // we look for the child <gco:CharacterString> directly.
        const fieldNode = this.selectNodes('./gco:CharacterString', matchingNode)[0]
                    || this.selectNodes('gco:CharacterString', matchingNode)[0]

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
