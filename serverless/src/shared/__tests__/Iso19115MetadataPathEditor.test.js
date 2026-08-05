import {
  beforeEach,
  describe,
  expect,
  test
} from 'vitest'

import Iso19115MetadataPathEditor from '@/shared/Iso19115MetadataPathEditor'

describe('Iso19115MetadataPathEditor', () => {
  let editor
  const xmlString = `
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
      <gmd:identificationInfo>
        <gmd:MD_DataIdentification>
          <gmd:topicCategory>
            <gmd:MD_TopicCategoryCode codeListValue="farming">farming</gmd:MD_TopicCategoryCode>
          </gmd:topicCategory>
        </gmd:MD_DataIdentification>
      </gmd:identificationInfo>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword><gco:CharacterString>Old Keyword</gco:CharacterString></gmd:keyword>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_Metadata>`

  beforeEach(() => {
    editor = new Iso19115MetadataPathEditor(xmlString)
  })

  test('should fallback to gco:CharacterString when explicit fieldPath is missing or invalid', () => {
  // 1. Setup: Keyword block WITHOUT a specific sub-path defined in replaceConfig,
  // but WITH a standard gco:CharacterString
    const xml = `
  <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
    <gmd:descriptiveKeywords>
      <gmd:MD_Keywords>
        <gmd:keyword>
          <gco:CharacterString>Old Value</gco:CharacterString>
        </gmd:keyword>
      </gmd:MD_Keywords>
    </gmd:descriptiveKeywords>
  </gmd:MD_Metadata>`

    editor = new Iso19115MetadataPathEditor(xml)

    // 2. Setup: Config with no fieldPath, forcing the fallback
    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        matchKeys: ['Value'],
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() })
      },
      replace: [{
      // No fieldPath provided
        source: { getValue: () => 'New Value' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Old Value' },
      newKeywordObject: { Value: 'New Value' }
    }

    // 3. Execute
    const success = editor.updateBlockNode(correction, config)

    // 4. Assertions
    expect(success).toBe(true)
    expect(editor.serialize()).toContain('New Value')
    expect(editor.serialize()).not.toContain('Old Value')
  })

  test('should initialize namespaces correctly', () => {
    expect(editor.namespaces).toHaveProperty('gmd')
    expect(editor.namespaces.gmd).toBe('http://www.isotc211.org/2005/gmd')
  })

  test('selectNodes should filter by ELEMENT_NODE', () => {
    const nodes = editor.selectNodes('//gmd:topicCategory')
    expect(nodes.length).toBe(1)
    expect(nodes[0].nodeType).toBe(1)
  })

  test('updateLeafNode should delete a simple leaf node', () => {
    const config = {
      nodeXPath: '//gmd:topicCategory',
      find: { getNodeValueObject: () => ({ Value: 'farming' }) }
    }
    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'farming' }
    }

    const result = editor.updateLeafNode(correction, config)

    expect(result).toBe(true)
    const nodes = editor.selectNodes('//gmd:topicCategory')
    expect(nodes.length).toBe(0)
  })

  test('updateLeafNode should execute explicit delete paths when provided', () => {
  // 1. Ensure the XML contains the node being searched for
    const xml = `
    <gmd:MD_Metadata xmlns:gco="http://www.isotc211.org/2005/gco"
      xmlns:gmd="http://www.isotc211.org/2005/gmd">
      <gmd:processingLevel>
        <gmd:MD_Identifier>
          <gmd:code><gco:CharacterString>L1</gco:CharacterString></gmd:code>
        </gmd:MD_Identifier>
      </gmd:processingLevel>
      <gmd:processingLevel>
        <gmd:MD_Identifier>
          <gmd:code><gco:CharacterString>L2</gco:CharacterString></gmd:code>
        </gmd:MD_Identifier>
      </gmd:processingLevel>
    </gmd:MD_Metadata>`

    // Create a new editor instance with this specific XML
    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:processingLevel/gmd:MD_Identifier',
      find: { getNodeValueObject: (ctx) => ({ Value: ctx.node.textContent }) },
      delete: [
        {
          path: '//gmd:processingLevel',
          matchValuePath: 'gmd:MD_Identifier/gmd:code/gco:CharacterString'
        }
      ]
    }
    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'l1' }
    }

    // This will now find the targetNode and proceed to execute the delete block
    const result = testEditor.updateLeafNode(correction, config)

    expect(result).toBe(true)
    expect(testEditor.serialize()).not.toContain('L1')
    expect(testEditor.serialize()).toContain('L2')
  })

  test('updateLeafNode should update element attribute when fieldPath includes @', () => {
    const xml = `
    <gmd:topicCategory xmlns:gmd="http://www.isotc211.org/2005/gmd">
      <gmd:MD_TopicCategoryCode codeListValue="oldValue">oldValue</gmd:MD_TopicCategoryCode>
    </gmd:topicCategory>`

    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:topicCategory',
      find: { getNodeValueObject: () => ({ Value: 'oldValue' }) },
      replace: [{
      // Path targets the attribute on the child element
        fieldPath: 'gmd:MD_TopicCategoryCode/@codeListValue',
        source: { getValue: () => 'newValue' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'oldValue' }
    }

    const result = testEditor.updateLeafNode(correction, config)

    expect(result).toBe(true)

    // Verify the attribute was updated in the DOM
    const element = testEditor.selectNodes('//gmd:MD_TopicCategoryCode')[0]
    expect(element.getAttribute('codeListValue')).toBe('newValue')
  })

  test('updateLeafNode should return false if node to delete is not found', () => {
    const config = {
      nodeXPath: '//gmd:topicCategory',
      find: { getNodeValueObject: () => ({ Value: 'missing' }) }
    }
    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'non-existent' }
    }

    const result = editor.updateLeafNode(correction, config)
    expect(result).toBe(false)
  })

  test('updateLeafNode should replace text content', () => {
    const config = {
      nodeXPath: '//gmd:topicCategory',
      find: { getNodeValueObject: () => ({ Value: 'farming' }) },
      replace: [{
        fieldPath: 'gmd:MD_TopicCategoryCode',
        source: { getValue: () => 'updated-value' }
      }]
    }
    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'farming' }
    }

    const result = editor.updateLeafNode(correction, config)
    expect(result).toBe(true)
    // Verification would depend on the implementation of setElementText
  })

  test('updateBlockNode should find and update keyword nodes', () => {
    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: () => ({ Value: 'Old Keyword' }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'gco:CharacterString',
        source: { getValue: () => 'New Keyword' }
      }]
    }
    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Old Keyword' },
      newKeywordObject: { Value: 'New Keyword' }
    }

    const result = editor.updateBlockNode(correction, config)
    expect(result).toBe(true)
  })

  test('updateBlockNode should delete empty parents after removing last keyword', () => {
    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: () => ({ Value: 'Old Keyword' }),
        matchKeys: ['Value']
      }
    }
    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'Old Keyword' }
    }

    const result = editor.updateBlockNode(correction, config)
    expect(result).toBe(true)

    // Verify node removal
    const remaining = editor.selectNodes('//gmd:descriptiveKeywords')
    expect(remaining.length).toBe(0)
  })

  test('updateBlockNode should fallback to gco:CharacterString when specific fieldPath fails', () => {
    const xml = `
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:type>
             <gmd:MD_KeywordTypeCode codeListValue="theme" />
          </gmd:type>
          <gmd:keyword>
            <gco:CharacterString>Original Value</gco:CharacterString>
          </gmd:keyword>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_Metadata>`

    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
      // Add the missing function here
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'invalid/path',
        source: { getValue: () => 'New Value' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Original Value' },
      newKeywordObject: { Value: 'New Value' }
    }

    const result = testEditor.updateBlockNode(correction, config)

    expect(result).toBe(true)

    const updatedNode = testEditor.selectNodes('//gco:CharacterString', testEditor.document)[0]
    expect(updatedNode.textContent).toBe('New Value')
  })

  test('updateBlockNode should return false for unsupported actions', () => {
    const xml = `
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd">
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:type>
             <gmd:MD_KeywordTypeCode codeListValue="theme" />
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_Metadata>`

    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: { matchKeys: ['Value'] }
    }

    // Use an action that is not 'delete' or 'replace'
    const correction = {
      action: 'unsupported',
      oldKeywordObject: { Value: 'test' }
    }

    const result = testEditor.updateBlockNode(correction, config)

    expect(result).toBe(false)
  })

  test('updateBlockNode should return false when replacement node is not found', () => {
    const xml = `
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>Existing Keyword</gco:CharacterString>
          </gmd:keyword>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_Metadata>`

    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'gco:CharacterString',
        source: { getValue: () => 'New Value' }
      }]
    }

    // Correction object targeting a keyword that DOES NOT exist in the XML
    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Non-existent Keyword' },
      newKeywordObject: { Value: 'New Value' }
    }

    const result = testEditor.updateBlockNode(correction, config)

    expect(result).toBe(false)
  })

  test('updateBlockNode should return false when matching node exists but field node cannot be found', () => {
  // Use an XML structure that explicitly lacks a gco:CharacterString
  // within the matched keyword scope.
    const xml = `
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd">
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gmd:SomeOtherElement>Original Value</gmd:SomeOtherElement>
          </gmd:keyword>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_Metadata>`

    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: () => ({ Value: 'Original Value' }),
        matchKeys: ['Value']
      },
      replace: [{
      // Ensure this path does not exist
        fieldPath: 'non-existent/path',
        source: { getValue: () => 'New Value' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Original Value' },
      newKeywordObject: { Value: 'New Value' }
    }

    // 1. findMatchingNode finds the keyword node containing 'Original Value'.
    // 2. The explicit fieldPath fails.
    // 3. The fallback selectNodes('./gco:CharacterString', matchingNode) returns nothing.
    // 4. fieldNode remains null.
    // 5. The 'if (fieldNode)' check fails, skipping the update.
    // 6. Execution hits the 'return false' at line 156.
    const result = testEditor.updateBlockNode(correction, config)

    expect(result).toBe(false)
  })

  test('updateBlockNode should update ALL matching nodes when multiple are found', () => {
    const xml = `
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>Original Value</gco:CharacterString>
            <gco:CharacterString>Original Value</gco:CharacterString>
          </gmd:keyword>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_Metadata>`

    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: () => ({ Value: 'Original Value' }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'gco:CharacterString',
        source: { getValue: () => 'New Value' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Original Value' },
      newKeywordObject: { Value: 'New Value' }
    }

    const result = testEditor.updateBlockNode(correction, config)

    expect(result).toBe(true)

    // Verify that ALL CharacterString nodes were updated
    const updatedNodes = testEditor.selectNodes('//gco:CharacterString', testEditor.document)
    expect(updatedNodes.length).toBe(2)
    updatedNodes.forEach((node) => {
      expect(node.textContent).toBe('New Value')
    })
  })
})

describe('ISO Format Detection', () => {
  test('should detect MENDS format from XML without DS_Series', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi" xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:identificationInfo>
          <gmd:MD_DataIdentification>
            <gmd:citation/>
          </gmd:MD_DataIdentification>
        </gmd:identificationInfo>
      </gmi:MI_Metadata>
    `

    const editor = new Iso19115MetadataPathEditor(mendsXml)
    expect(editor.format).toBe('MENDS')
  })

  test('should detect SMAP format from XML with DS_Series', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo/>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml)
    expect(editor.format).toBe('SMAP')
  })

  test('should use explicitly provided format option over auto-detection', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi" xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:identificationInfo/>
      </gmi:MI_Metadata>
    `

    // Force SMAP format even though XML is MENDS structure
    const editor = new Iso19115MetadataPathEditor(mendsXml, { format: 'SMAP' })
    expect(editor.format).toBe('SMAP')
  })

  test('should default to MENDS when format detection is ambiguous', () => {
    const ambiguousXml = '<root/>'

    const editor = new Iso19115MetadataPathEditor(ambiguousXml)
    expect(editor.format).toBe('MENDS')
  })
})

describe('XPath Transformation for SMAP', () => {
  test('should not transform XPath for MENDS format', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi" xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:identificationInfo/>
      </gmi:MI_Metadata>
    `

    const editor = new Iso19115MetadataPathEditor(mendsXml, { format: 'MENDS' })
    const xpath = '//gmd:identificationInfo'

    expect(editor.transformXPath(xpath)).toBe(xpath)
  })

  test('should transform absolute XPath for SMAP format', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo/>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })
    const xpath = '//gmd:identificationInfo'
    const transformed = editor.transformXPath(xpath)

    expect(transformed).toBe('/gmd:DS_Series/gmd:seriesMetadata/gmi:MI_Metadata//gmd:identificationInfo')
  })

  test('should not transform relative XPath for SMAP format', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"/>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })
    const xpath = './gmd:keyword'

    expect(editor.transformXPath(xpath)).toBe('./gmd:keyword')
  })

  test('should not transform already-transformed SMAP XPath', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"/>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })
    const xpath = '/gmd:DS_Series/gmd:seriesMetadata/gmi:MI_Metadata//gmd:identificationInfo'

    expect(editor.transformXPath(xpath)).toBe(xpath)
  })

  test('should transform XPath with complex predicates', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"/>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })
    const xpath = '//gmd:descriptiveKeywords/gmd:MD_Keywords[gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = "theme"]'
    const transformed = editor.transformXPath(xpath)

    expect(transformed).toContain('/gmd:DS_Series/gmd:seriesMetadata/gmi:MI_Metadata//')
    expect(transformed).toContain('gmd:descriptiveKeywords/gmd:MD_Keywords')
  })
})

describe('SMAP Node Selection', () => {
  test('should select nodes from SMAP XML structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:descriptiveKeywords>
                  <gmd:MD_Keywords>
                    <gmd:keyword>
                      <gco:CharacterString>Test Keyword</gco:CharacterString>
                    </gmd:keyword>
                  </gmd:MD_Keywords>
                </gmd:descriptiveKeywords>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })
    const nodes = editor.selectNodes('//gmd:descriptiveKeywords')

    expect(nodes.length).toBe(1)
    expect(nodes[0].localName).toBe('descriptiveKeywords')
  })

  test('should select nested nodes within SMAP structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:topicCategory>
                  <gmd:MD_TopicCategoryCode>farming</gmd:MD_TopicCategoryCode>
                </gmd:topicCategory>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })
    const nodes = editor.selectNodes('//gmd:topicCategory/gmd:MD_TopicCategoryCode')

    expect(nodes.length).toBe(1)
    expect(nodes[0].textContent).toBe('farming')
  })

  test('should return empty array when nodes not found in SMAP structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo/>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })
    const nodes = editor.selectNodes('//gmd:nonExistentElement')

    expect(nodes.length).toBe(0)
  })
})

describe('SMAP Metadata Updates', () => {
  test('should update leaf node in SMAP structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:topicCategory>
                  <gmd:MD_TopicCategoryCode codeListValue="farming">farming</gmd:MD_TopicCategoryCode>
                </gmd:topicCategory>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const config = {
      nodeXPath: '//gmd:identificationInfo/gmd:MD_DataIdentification/gmd:topicCategory',
      find: { getNodeValueObject: () => ({ Value: 'farming' }) },
      replace: [{
        fieldPath: 'gmd:MD_TopicCategoryCode',
        source: { getValue: () => 'climatologyMeteorologyAtmosphere' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'farming' }
    }

    const result = editor.updateLeafNode(correction, config)

    expect(result).toBe(true)
    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('climatologyMeteorologyAtmosphere')
    expect(updatedXml).not.toContain('>farming<')
  })

  test('should delete leaf node in SMAP structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:topicCategory>
                  <gmd:MD_TopicCategoryCode>farming</gmd:MD_TopicCategoryCode>
                </gmd:topicCategory>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const config = {
      nodeXPath: '//gmd:topicCategory',
      find: { getNodeValueObject: () => ({ Value: 'farming' }) }
    }

    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'farming' }
    }

    const result = editor.updateLeafNode(correction, config)

    expect(result).toBe(true)
    const nodes = editor.selectNodes('//gmd:topicCategory')
    expect(nodes.length).toBe(0)
  })

  test('should update block node in SMAP structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:descriptiveKeywords>
                  <gmd:MD_Keywords>
                    <gmd:keyword>
                      <gco:CharacterString>Old Keyword</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                      <gmd:MD_KeywordTypeCode codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                  </gmd:MD_Keywords>
                </gmd:descriptiveKeywords>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords[gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = "theme"]',
      find: {
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'gco:CharacterString',
        source: { getValue: () => 'New Keyword' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Old Keyword' },
      newKeywordObject: { Value: 'New Keyword' }
    }

    const result = editor.updateBlockNode(correction, config)

    expect(result).toBe(true)
    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('New Keyword')
    expect(updatedXml).not.toContain('Old Keyword')
  })

  test('should delete block node in SMAP structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:descriptiveKeywords>
                  <gmd:MD_Keywords>
                    <gmd:keyword>
                      <gco:CharacterString>Keyword to Delete</gco:CharacterString>
                    </gmd:keyword>
                  </gmd:MD_Keywords>
                </gmd:descriptiveKeywords>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() }),
        matchKeys: ['Value']
      }
    }

    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'Keyword to Delete' }
    }

    const result = editor.updateBlockNode(correction, config)

    expect(result).toBe(true)
    const nodes = editor.selectNodes('//gmd:descriptiveKeywords')
    expect(nodes.length).toBe(0)
  })

  test('should handle multiple keywords in SMAP structure', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:descriptiveKeywords>
                  <gmd:MD_Keywords>
                    <gmd:keyword>
                      <gco:CharacterString>Keyword 1</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:keyword>
                      <gco:CharacterString>Keyword 2</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                      <gmd:MD_KeywordTypeCode codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                  </gmd:MD_Keywords>
                </gmd:descriptiveKeywords>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords[gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = "theme"]',
      find: {
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'gco:CharacterString',
        source: { getValue: () => 'Updated Keyword 1' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Keyword 1' },
      newKeywordObject: { Value: 'Updated Keyword 1' }
    }

    const result = editor.updateBlockNode(correction, config)

    expect(result).toBe(true)
    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('Updated Keyword 1')
    expect(updatedXml).toContain('Keyword 2') // Second keyword unchanged
  })

  test('should preserve SMAP structure after updates', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:descriptiveKeywords>
                  <gmd:MD_Keywords>
                    <gmd:keyword>
                      <gco:CharacterString>Test</gco:CharacterString>
                    </gmd:keyword>
                  </gmd:MD_Keywords>
                </gmd:descriptiveKeywords>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'gco:CharacterString',
        source: { getValue: () => 'Updated' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Test' },
      newKeywordObject: { Value: 'Updated' }
    }

    editor.updateBlockNode(correction, config)
    const updatedXml = editor.serialize()

    // Verify SMAP wrapper structure is preserved
    expect(updatedXml).toContain('<gmd:DS_Series')
    expect(updatedXml).toContain('<gmd:seriesMetadata>')
    expect(updatedXml).toContain('<gmi:MI_Metadata')
  })
})

describe('SMAP vs MENDS Comparison', () => {
  test('should handle same XPath differently for MENDS and SMAP', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi" xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:identificationInfo>
          <gmd:MD_DataIdentification>
            <gmd:topicCategory>
              <gmd:MD_TopicCategoryCode>farming</gmd:MD_TopicCategoryCode>
            </gmd:topicCategory>
          </gmd:MD_DataIdentification>
        </gmd:identificationInfo>
      </gmi:MI_Metadata>
    `

    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:topicCategory>
                  <gmd:MD_TopicCategoryCode>farming</gmd:MD_TopicCategoryCode>
                </gmd:topicCategory>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const mendsEditor = new Iso19115MetadataPathEditor(mendsXml, { format: 'MENDS' })
    const smapEditor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const xpath = '//gmd:topicCategory'

    // Both should find the node despite different structures
    const mendsNodes = mendsEditor.selectNodes(xpath)
    const smapNodes = smapEditor.selectNodes(xpath)

    expect(mendsNodes.length).toBe(1)
    expect(smapNodes.length).toBe(1)
    expect(mendsNodes[0].localName).toBe('topicCategory')
    expect(smapNodes[0].localName).toBe('topicCategory')
  })

  test('should apply same correction to both MENDS and SMAP formats', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi" xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:descriptiveKeywords>
          <gmd:MD_Keywords>
            <gmd:keyword>
              <gco:CharacterString>Original</gco:CharacterString>
            </gmd:keyword>
          </gmd:MD_Keywords>
        </gmd:descriptiveKeywords>
      </gmi:MI_Metadata>
    `

    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:descriptiveKeywords>
              <gmd:MD_Keywords>
                <gmd:keyword>
                  <gco:CharacterString>Original</gco:CharacterString>
                </gmd:keyword>
              </gmd:MD_Keywords>
            </gmd:descriptiveKeywords>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const mendsEditor = new Iso19115MetadataPathEditor(mendsXml, { format: 'MENDS' })
    const smapEditor = new Iso19115MetadataPathEditor(smapXml, { format: 'SMAP' })

    const config = {
      nodeXPath: '//gmd:descriptiveKeywords/gmd:MD_Keywords',
      find: {
        getNodeValueObject: ({ node }) => ({ Value: node.textContent.trim() }),
        matchKeys: ['Value']
      },
      replace: [{
        fieldPath: 'gco:CharacterString',
        source: { getValue: () => 'Updated' }
      }]
    }

    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'Original' },
      newKeywordObject: { Value: 'Updated' }
    }

    const mendsResult = mendsEditor.updateBlockNode(correction, config)
    const smapResult = smapEditor.updateBlockNode(correction, config)

    expect(mendsResult).toBe(true)
    expect(smapResult).toBe(true)

    const mendsUpdated = mendsEditor.serialize()
    const smapUpdated = smapEditor.serialize()

    expect(mendsUpdated).toContain('Updated')
    expect(smapUpdated).toContain('Updated')
    expect(mendsUpdated).not.toContain('>Original<')
    expect(smapUpdated).not.toContain('>Original<')
  })
})
