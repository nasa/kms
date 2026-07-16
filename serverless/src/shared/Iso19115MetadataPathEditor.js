import xpath from 'xpath'

import XmlMetadataPathEditor from './XmlMetadataPathEditor'
import { extractNamespaces } from './XmlUtils'

/**
 * Detects whether XML is SMAP or MENDS format based on root element structure.
 * @param {string} xmlString - XML content to analyze.
 * @returns {'SMAP'|'MENDS'} Detected format type.
 */
export const detectIsoFormat = (xmlString) => {
  // SMAP files contain DS_Series root element wrapping the metadata
  if (xmlString.includes('<gmd:DS_Series') || xmlString.includes(':DS_Series')) {
    return 'SMAP'
  }

  return 'MENDS'
}

/**
 * Subclass of XmlMetadataPathEditor specialized for ISO 19115 XML structure.
 * Handles namespace resolution and provides specific methods for updating
 * keyword blocks and leaf nodes within ISO 19115 metadata.
 *
 * Supports both ISO-MENDS and ISO-SMAP formats through automatic XPath transformation.
 */
export class Iso19115MetadataPathEditor extends XmlMetadataPathEditor {
  /**
   * @param {string} xmlString - Raw XML metadata string
   * @param {object} options - Editor configuration options
   * @param {string} [options.format] - Format type: 'MENDS' or 'SMAP'. Auto-detected if not provided.
   */
  constructor(xmlString, options = {}) {
    super(xmlString)

    // Auto-detect format if not explicitly provided, defaulting to MENDS for backward compatibility
    this.format = options.format || detectIsoFormat(xmlString)

    const root = this.document.documentElement

    // 1. Get dynamic namespaces
    const extracted = extractNamespaces(root)

    // 2. Define standard ISO 19115 namespaces
    const standardNamespaces = {
      gco: 'http://www.isotc211.org/2005/gco',
      gmd: 'http://www.isotc211.org/2005/gmd',
      gmi: 'http://www.isotc211.org/2005/gmi',
      gmx: 'http://www.isotc211.org/2005/gmx',
      gml: 'http://www.opengis.net/gml/3.2',
      eos: 'http://earthdata.nasa.gov/schema/eos'
    }

    // 3. Merge them, prioritizing extracted ones (if any)
    this.namespaces = {
      ...standardNamespaces,
      ...extracted
    }

    this.resolver = xpath.useNamespaces(this.namespaces)
  }

  /**
   * Transforms XPath expressions based on the target format (MENDS vs SMAP).
   *
   * SMAP format wraps all metadata in /gmd:DS_Series/gmd:seriesMetadata/, while
   * MENDS uses the root MI_Metadata directly. This method automatically adjusts
   * absolute XPath expressions to work with the target format.
   *
   * @param {string} xpathExpression - Original XPath expression
   * @returns {string} Transformed XPath for the target format
   *
   * @example
   * // MENDS format (no transformation)
   * transformXPath('//gmd:descriptiveKeywords')
   * // => '//gmd:descriptiveKeywords'
   *
   * // SMAP format (adds wrapper path)
   * transformXPath('//gmd:descriptiveKeywords')
   * // => '/gmd:DS_Series/gmd:seriesMetadata//gmd:descriptiveKeywords'
   */
  transformXPath(xpathExpression) {
    if (this.format === 'SMAP') {
      // Only transform absolute paths that aren't already SMAP-formatted
      if (xpathExpression.startsWith('//') && !xpathExpression.includes('/gmd:DS_Series')) {
        // Remove leading '//' and prepend SMAP wrapper path
        const relativePath = xpathExpression.substring(2)

        return `/gmd:DS_Series/gmd:seriesMetadata/gmi:MI_Metadata//${relativePath}`
      }
    }

    return xpathExpression
  }

  /**
   * Executes an XPath expression and ensures only element nodes are returned.
   * Automatically transforms paths based on the detected or specified format.
   *
   * @param {string} expression - The XPath string.
   * @param {Node} contextNode - The XML node to execute the search against.
   * @returns {Node[]} Array of matching Element nodes.
   */
  selectNodes(expression, contextNode = this.document) {
    const transformedExpression = this.transformXPath(expression)

    // Use resolver to find nodes; filter to ELEMENT_NODE (nodeType 1)
    // to prevent errors during DOM manipulation
    return this.resolver(transformedExpression, contextNode)
      .filter((node) => node?.nodeType === 1)
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
          const isGlobal = replConfig.fieldPath.startsWith('//')
          const context = isGlobal ? this.document : matchingNode

          // If updating an attribute (contains @)
          if (replConfig.fieldPath.includes('@')) {
            const [path, attr] = replConfig.fieldPath.split('/@')
            const targetElement = this.selectNodes(isGlobal ? path : `./${path}`, context)[0]
            if (targetElement) {
              const newValue = replConfig.source.getValue({
                correction,
                node: targetElement,
                editor: this
              })
              targetElement.setAttribute(attr, newValue)
            }
          } else {
            // Standard text content update
            const targetNode = this.selectNodes(isGlobal ? replConfig.fieldPath : `./${replConfig.fieldPath}`, context)[0]
            if (targetNode) {
              const newValue = replConfig.source.getValue({
                correction,
                node: targetNode,
                editor: this
              })
              this.setElementText(targetNode, newValue)
            }
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
      .find((data) => data.matchingNode !== null && data.matchingNode !== undefined)

    // Return early if no match is found, preventing downstream errors
    if (!matchingData) return false

    const { matchingNode } = matchingData

    // 2. Handle 'delete' action
    if (correction.action === 'delete') {
      const parentBlock = matchingNode.parentNode

      // Initialize keywordValue here so it is available in the scope
      const keywordValue = matchingNode.textContent.trim()

      // Get the ShortName for matching acquisition information entries
      const oldShortName = correction.oldKeywordObject?.ShortName

      // Only platforms and instruments have acquisition information sections
      const isPlatformOrInstrument = correction.scheme === 'platforms' || correction.scheme === 'instruments'

      // For platforms/instruments, delete from acquisition section too
      if (isPlatformOrInstrument && oldShortName && config.replace) {
        // Find all MD_Identifier nodes that match this platform/instrument
        // AND have the correct codeSpace to identify them as acquisition info
        const allIdentifiers = this.selectNodes('//gmd:MD_Identifier', this.document)
        const identifiersToDelete = allIdentifiers.filter((identifier) => {
          const codeNodes = this.selectNodes('.//gmd:code/gco:CharacterString', identifier)
          if (codeNodes.length === 0) {
            return false
          }

          const codeValue = codeNodes[0].textContent?.trim() || ''
          const codeMatches = codeValue === oldShortName || codeValue.startsWith(`${oldShortName} > `)

          if (!codeMatches) {
            return false
          }

          // Check codeSpace to ensure this is an acquisition identifier
          const codeSpaceNodes = this.selectNodes('.//gmd:codeSpace/gco:CharacterString', identifier)
          if (codeSpaceNodes.length > 0) {
            const codeSpaceValue = codeSpaceNodes[0].textContent?.trim() || ''

            // Match acquisition-specific codeSpace values based on scheme
            const isAcquisitionIdentifier = correction.scheme === 'platforms'
              ? codeSpaceValue === 'gov.nasa.esdis.umm.platformshortname'
              : codeSpaceValue === 'gov.nasa.esdis.umm.instrumentshortname'

            return isAcquisitionIdentifier
          }

          // If no codeSpace, check if identifier is within acquisitionInformation context
          let current = identifier.parentNode
          while (current && current !== this.document.documentElement) {
            if (current.localName === 'acquisitionInformation'
          || current.localName === 'MI_AcquisitionInformation') {
              return true
            }

            current = current.parentNode
          }

          return false
        })

        // Delete the parent platform/instrument nodes from acquisition section
        identifiersToDelete.forEach((identifier) => {
          // Navigate up DOM tree to find the acquisition platform/instrument wrapper node
          let currentNode = identifier.parentNode
          while (currentNode) {
            const { localName } = currentNode
            // Check if we found a platform or instrument node
            if (localName === 'EOS_Platform' || localName === 'MI_Platform'
          || localName === 'EOS_Instrument' || localName === 'MI_Instrument') {
              // Found the acquisition wrapper node, remove it entirely
              if (currentNode.parentNode) {
                currentNode.parentNode.removeChild(currentNode)
              }

              break
            }

            // Move up the tree
            currentNode = currentNode.parentNode
            // Stop if we reach the document root
            if (currentNode === this.document.documentElement) {
              break
            }
          }
        })
      }

      if (correction.scheme === 'projects' && oldShortName) {
        // Find all project identifiers in acquisitionInformation
        const allIdentifiers = this.selectNodes('//gmi:operation//gmd:MD_Identifier', this.document)

        const identifiersToDelete = allIdentifiers.filter((identifier) => {
          // Check for the specific codeSpace used in your config
          const codeSpaceNodes = this.selectNodes('.//gmd:codeSpace/gco:CharacterString', identifier)
          const codeSpace = codeSpaceNodes[0]?.textContent?.trim()

          if (codeSpace !== 'gov.nasa.esdis.umm.projectshortname') return false

          // Verify it matches the project we are deleting
          const codeNodes = this.selectNodes('.//gmd:code/gco:CharacterString', identifier)
          const codeValue = codeNodes[0]?.textContent?.trim() || ''

          // Check for exact match or the combined 'ShortName > LongName' format
          return codeValue === oldShortName || codeValue.startsWith(`${oldShortName} > `)
        })

        // Remove the parent MI_Operation node
        identifiersToDelete.forEach((identifier) => {
          let currentNode = identifier.parentNode
          while (currentNode) {
            if (currentNode.localName === 'MI_Operation') {
              if (currentNode.parentNode) {
                currentNode.parentNode.removeChild(currentNode)
              }

              break
            }

            currentNode = currentNode.parentNode
            if (currentNode === this.document.documentElement) break
          }
        })
      }

      // Clean up synchronized paths globally, but with a value constraint
      // This handles providers and other non-acquisition paths
      if (config.replace) {
        config.replace
          .filter((replConfig) => typeof replConfig.fieldPath === 'string' && replConfig.fieldPath.startsWith('//'))
          .forEach((replConfig) => {
            // Find all nodes in the document that match the path
            const allPotentialMatches = this.selectNodes(replConfig.fieldPath, this.document)

            // Filter those nodes: only remove the ones whose text content
            // matches the keyword we are currently deleting
            allPotentialMatches
              .filter((node) => node.textContent.trim() === keywordValue)
              .forEach((node) => {
                if (node?.parentNode) node.parentNode.removeChild(node)
              })
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
      // Pre-scan: Build a map of identifiers that should be updated
      // This prevents issues when processing multiple paths in sequence
      const oldShortName = correction.oldKeywordObject?.ShortName
      let identifiersToUpdate = []

      if (oldShortName) {
        // Find all MD_Identifier nodes that have code matching oldShortName
        const allIdentifiers = this.selectNodes('//gmd:MD_Identifier', this.document)
        identifiersToUpdate = allIdentifiers.filter((identifier) => {
          const codeNodes = this.selectNodes('.//gmd:code/gco:CharacterString', identifier)
          if (codeNodes.length > 0) {
            const codeValue = codeNodes[0].textContent?.trim() || ''

            return codeValue === oldShortName || codeValue.startsWith(`${oldShortName} > `)
          }

          return false
        })
      }

      const results = config.replace.map((replaceConfig) => {
        let fieldNodes = []
        let path = null

        // 1. Attempt to find nodes via the provided path
        if (replaceConfig.fieldPath) {
          path = typeof replaceConfig.fieldPath === 'function'
            ? replaceConfig.fieldPath({
              node: matchingNode,
              editor: this
            })
            : replaceConfig.fieldPath

          const context = path.startsWith('//') ? this.document : matchingNode
          const relativePath = path.startsWith('//') ? path : `./${path}`

          fieldNodes = this.selectNodes(relativePath, context)
        }

        // 2. Fallback: If no nodes were found via path,
        // ONLY check for the default text node if the path is relative (not global)
        // Global paths (starting with //) should not fall back to keyword block updates
        if (fieldNodes.length === 0 && (!path || !path.startsWith('//'))) {
          fieldNodes = this.selectNodes('./gco:CharacterString', matchingNode)
        }

        // 3. Update every node found
        if (fieldNodes.length > 0) {
          // For global paths (starting with //), filter to only update matching nodes
          // This prevents updating all platforms when we only want to update one
          if (path && path.startsWith('//') && identifiersToUpdate.length > 0) {
            // Filter nodes: only include nodes within the pre-scanned identifiers
            fieldNodes = fieldNodes.filter((node) => {
              // Navigate up to find the MD_Identifier parent
              let identifier = node.parentNode
              while (identifier && identifier.localName !== 'MD_Identifier') {
                identifier = identifier.parentNode
                if (!identifier || identifier === this.document.documentElement) {
                  return false
                }
              }

              // Check if this identifier is in our list to update
              return identifiersToUpdate.includes(identifier)
            })
          }

          fieldNodes.forEach((node) => {
            const newValue = replaceConfig.source.getValue({
              correction,
              node,
              editor: this
            })
            this.setElementText(node, newValue)
          })

          return fieldNodes.length > 0
        }

        return false
      })

      return results.some((success) => success === true)
    }

    return false
  }
}

export default Iso19115MetadataPathEditor
