import xpath from 'xpath'

import XmlMetadataPathEditor from './XmlMetadataPathEditor'
import {
  extractNamespaces,
  getScalarKeywordText,
  trimString
} from './XmlUtils'

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

  updateBlockNode(correction, config) {
    // 1. Find the parent block using your namespaced XPath
    const targetNode = this.selectNodes(config.nodeXPath)[0] || null
    if (!targetNode) return false

    // 2. Handle the 'delete' action
    if (correction.action === 'delete') {
      const oldVal = correction.oldKeywordObject.Value || correction.oldKeywordObject.ShortName

      // Find the specific <gmd:keyword> node containing the string to delete
      // We look for a CharacterString that contains the old value
      // We use the block (targetNode) as the context to keep search scoped
      const xPath = `.//gmd:keyword/gco:CharacterString[contains(., '${oldVal}')]`
      const targetCharString = this.selectNodes(xPath, targetNode)[0]

      if (!targetCharString) return false

      // A. Remove the specific keyword entry
      const keywordNode = targetCharString.parentNode
      keywordNode.parentNode.removeChild(keywordNode)

      // B. Check if any keywords remain in the MD_Keywords block
      const remainingKeywords = this.selectNodes('.//gmd:keyword', targetNode)

      if (remainingKeywords.length === 0) {
        // C. If no keywords remain, remove the MD_Keywords block
        const mdKeywordsParent = targetNode.parentNode
        mdKeywordsParent.removeChild(targetNode)

        // D. Check if the gmd:descriptiveKeywords wrapper is now empty
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
          const parsedValue = parsedObject[key] ? trimString(parsedObject[key]) : ''
          const correctionValue = correction.oldKeywordObject[key] ? trimString(correction.oldKeywordObject[key]) : ''

          return parsedValue === correctionValue
        })
      })

      // In Iso19115MetadataPathEditor.js

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

  /**
   * Override updateLeafNode to handle gco:CharacterString wrapping.
   * ISO 19115 frequently stores text values inside <gco:CharacterString> nodes.
   */
  updateLeafNode(correction, config) {
    const targetNode = this.selectNodes(config.nodeXPath)[0] || null
    if (!targetNode) return false

    // Target the specific gco:CharacterString child
    const charString = targetNode.getElementsByTagNameNS(this.namespaces.gco, 'CharacterString')[0]
    if (charString) {
      const value = getScalarKeywordText(correction?.newKeywordObject)
      this.setElementText(charString, value)

      return true
    }

    return false
  }
}
export default Iso19115MetadataPathEditor
