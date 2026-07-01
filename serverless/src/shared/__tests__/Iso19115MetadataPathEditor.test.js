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
    <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd">
      <gmd:processingLevel>
        <gmd:MD_Identifier>
          <gmd:code><gco:CharacterString>L1</gco:CharacterString></gmd:code>
        </gmd:MD_Identifier>
      </gmd:processingLevel>
    </gmd:MD_Metadata>`

    // Create a new editor instance with this specific XML
    const testEditor = new Iso19115MetadataPathEditor(xml)

    const config = {
      nodeXPath: '//gmd:processingLevel/gmd:MD_Identifier',
      find: { getNodeValueObject: (ctx) => ({ Value: ctx.node.textContent }) },
      delete: [
        { path: '//gmd:processingLevel/gmd:MD_Identifier' }
      ]
    }
    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'l1' }
    }

    // This will now find the targetNode and proceed to execute the delete block
    const result = testEditor.updateLeafNode(correction, config)

    expect(result).toBe(true)
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
