import {
  describe,
  expect,
  test
} from 'vitest'

import { sequentialValueReplace, XmlMetadataPathEditor } from '../XmlMetadataPathEditor'

const CRYOSPHERE_SNOW_ICE_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'CRYOSPHERE',
  Term: '',
  VariableLevel1: 'SNOW/ICE',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const CRYOSPHERE_SNOW_ICE_TERM_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'CRYOSPHERE',
  Term: 'SNOW/ICE',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const CRYOSPHERE_SNOW_ICE_RENAMED_TERM_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'CRYOSPHERE',
  Term: 'SNOW/ICE - chris v5',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

describe('when using XmlMetadataPathEditor object helpers', () => {
  test('should build sequential value mappings for ordered field paths', () => {
    expect(sequentialValueReplace(['Category', 'Topic', 'Term'])).toEqual([
      {
        fieldPath: 'Category',
        source: {
          type: 'value',
          key: 'Category',
          valueKeys: ['Category', 'Topic', 'Term']
        }
      },
      {
        fieldPath: 'Topic',
        source: {
          type: 'value',
          key: 'Topic',
          valueKeys: ['Category', 'Topic', 'Term']
        }
      },
      {
        fieldPath: 'Term',
        source: {
          type: 'value',
          key: 'Term',
          valueKeys: ['Category', 'Topic', 'Term']
        }
      }
    ])
  })
})

describe('when using XmlMetadataPathEditor DOM helpers', () => {
  test('should return no child elements for an undefined node', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Node><A>one</A></Node></DIF>')

    expect(editor.getElementChildren(undefined)).toEqual([])
  })

  test('should build ordered node field values with default options', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Node><A>one</A><B></B></Node></DIF>')
    const node = editor.selectNodes('//DIF/Node')[0]

    expect(editor.getNodeFieldValues(node, ['A', 'B'])).toEqual(['one', ''])
  })

  test('should remove direct nested elements and ignore detached nodes', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Node><Child>1</Child></Node></DIF>')
    const node = editor.selectNodes('//DIF/Node')[0]
    const detached = editor.document.createElement('Detached')

    editor.removeNestedElement(node, 'Child')
    editor.removeNode(detached)

    expect(editor.selectNodes('//DIF/Child')).toEqual([])
  })

  test('should ignore nested removals when the intermediate parent path does not exist', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Node><Child>1</Child></Node></DIF>')
    const node = editor.selectNodes('//DIF/Node')[0]

    editor.removeNestedElement(node, 'Missing/Child')

    expect(editor.getElementText(editor.selectNodes('//DIF/Node/Child')[0])).toBe('1')
  })

  test('should derive replacement values from params and keyword objects', () => {
    const editor = new XmlMetadataPathEditor('<DIF/>')

    expect(editor.getReplacementValue(
      { newLongName: 'Long Name' },
      {
        type: 'param',
        key: 'newLongName'
      }
    )).toBe('Long Name')

    expect(editor.getReplacementValue(
      {
        newKeywordObject: {
          Type: 'B'
        }
      },
      {
        type: 'value',
        key: 'Type'
      }
    )).toBe('B')

    expect(editor.getReplacementValue(
      {
        newKeywordObject: {
          Type: ''
        }
      },
      {
        type: 'value',
        key: 'Type'
      }
    )).toBe('')

    expect(editor.getReplacementValue(
      { newKeywordObject: { Type: 'B' } }
    )).toBe('')
  })

  test('should derive replacement values from canonical keyword objects', () => {
    const editor = new XmlMetadataPathEditor('<DIF/>')

    expect(editor.getReplacementValue(
      {
        newKeywordObject: CRYOSPHERE_SNOW_ICE_KEYWORD
      },
      {
        type: 'value',
        key: 'VariableLevel1'
      }
    )).toBe('SNOW/ICE')
  })

  test('should fall back to fieldPaths and empty scalar keyword text when optional values are absent', () => {
    const editor = new XmlMetadataPathEditor(`
      <DIF>
        <Node>
          <A>one</A>
          <B>two</B>
        </Node>
      </DIF>
    `)

    expect(editor.resolveNodeByFind({
      oldKeywordObject: {}
    }, {
      nodeXPath: '//DIF/Node',
      find: {
        fieldPaths: ['A', 'B']
      }
    })).toBeNull()

    expect(editor.updateScalarNode({
      action: 'replace'
    }, {
      nodeXPath: '//DIF/Missing',
      tagName: 'Missing'
    })).toBe(false)
  })

  test('should fall back to the first non-empty object value for scalar replacements', () => {
    const editor = new XmlMetadataPathEditor(`
      <DIF>
        <Product_Level_Id>Legacy</Product_Level_Id>
      </DIF>
    `)

    expect(editor.updateScalarNode({
      action: 'replace',
      newKeywordObject: {
        Alias: 'Level 1A'
      }
    }, {
      nodeXPath: '//DIF/Product_Level_Id',
      tagName: 'Product_Level_Id'
    })).toBe(true)

    expect(editor.getElementText(editor.selectNodes('//DIF/Product_Level_Id')[0])).toBe('Level 1A')
  })
})

describe('when updating XML nodes through XmlMetadataPathEditor', () => {
  test('should match a shorter correction path against a padded XML hierarchy', () => {
    const editor = new XmlMetadataPathEditor(`
      <DIF>
        <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>ATMOSPHERE</Topic>
          <Term>AEROSOLS</Term>
        </Science_Keywords>
      </DIF>
    `)

    const isUpdated = editor.updateBlockNode({
      action: 'replace',
      oldKeywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      },
      newKeywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'OCEANS',
        Term: 'MARINE SEDIMENTS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    }, {
      nodeXPath: '//DIF/Science_Keywords',
      find: {
        fieldPaths: [
          'Category',
          'Topic',
          'Term',
          'Variable_Level_1',
          'Variable_Level_2',
          'Variable_Level_3',
          'Detailed_Variable'
        ],
        valueKeys: [
          'Category',
          'Topic',
          'Term',
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
        ]
      },
      replace: sequentialValueReplace(
        [
          'Category',
          'Topic',
          'Term',
          'Variable_Level_1',
          'Variable_Level_2',
          'Variable_Level_3',
          'Detailed_Variable'
        ],
        [
          'Category',
          'Topic',
          'Term',
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
        ]
      )
    })

    expect(isUpdated).toBe(true)
    expect(editor.serialize()).toContain('<Topic>OCEANS</Topic>')
    expect(editor.serialize()).toContain('<Term>MARINE SEDIMENTS</Term>')
  })

  test('should match and update block nodes in DIF10 payloads with a default namespace', () => {
    const editor = new XmlMetadataPathEditor(`
      <DIF xmlns="http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/">
        <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>CRYOSPHERE</Topic>
          <Term>SNOW/ICE</Term>
        </Science_Keywords>
      </DIF>
    `)

    const isUpdated = editor.updateBlockNode({
      action: 'replace',
      oldKeywordObject: CRYOSPHERE_SNOW_ICE_TERM_KEYWORD,
      newKeywordObject: CRYOSPHERE_SNOW_ICE_RENAMED_TERM_KEYWORD
    }, {
      nodeXPath: '//DIF/Science_Keywords',
      find: {
        fieldPaths: [
          'Category',
          'Topic',
          'Term',
          'Variable_Level_1',
          'Variable_Level_2',
          'Variable_Level_3',
          'Detailed_Variable'
        ],
        valueKeys: [
          'Category',
          'Topic',
          'Term',
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
        ]
      },
      replace: sequentialValueReplace(
        [
          'Category',
          'Topic',
          'Term',
          'Variable_Level_1',
          'Variable_Level_2',
          'Variable_Level_3',
          'Detailed_Variable'
        ],
        [
          'Category',
          'Topic',
          'Term',
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
        ]
      )
    })

    expect(isUpdated).toBe(true)
    expect(editor.serialize()).toContain('<Term>SNOW/ICE - chris v5</Term>')
  })

  test('should invoke afterDelete callbacks for block nodes', () => {
    let callbackNodeName = null
    const editor = new XmlMetadataPathEditor('<DIF><Block><Short_Name>ONE</Short_Name></Block></DIF>')

    const isUpdated = editor.updateBlockNode({
      action: 'delete',
      oldKeywordObject: {
        ShortName: 'ONE'
      }
    }, {
      nodeXPath: '//DIF/Block',
      find: {
        fieldPaths: ['Short_Name'],
        valueKeys: ['ShortName']
      },
      afterDelete: (_, targetNode) => {
        callbackNodeName = targetNode.nodeName
      }
    })

    expect(isUpdated).toBe(true)
    expect(callbackNodeName).toBe('Block')
    expect(editor.selectNodes('//DIF/Block')).toEqual([])
  })

  test('should invoke afterReplace callbacks for block nodes', () => {
    let callbackNodeName = null
    const editor = new XmlMetadataPathEditor('<DIF><Block><Short_Name>ONE</Short_Name></Block></DIF>')

    const isUpdated = editor.updateBlockNode({
      action: 'replace',
      oldKeywordObject: {
        ShortName: 'ONE'
      },
      newKeywordObject: {
        ShortName: 'TWO'
      }
    }, {
      nodeXPath: '//DIF/Block',
      find: {
        fieldPaths: ['Short_Name'],
        valueKeys: ['ShortName']
      },
      replace: [
        {
          fieldPath: 'Short_Name',
          source: {
            type: 'value',
            key: 'ShortName'
          }
        }
      ],
      afterReplace: (_, targetNode) => {
        callbackNodeName = targetNode.nodeName
      }
    })

    expect(isUpdated).toBe(true)
    expect(callbackNodeName).toBe('Block')
    expect(editor.serialize()).toContain('<Short_Name>TWO</Short_Name>')
  })

  test('should replace leaf node text with an empty string when the new keyword object has no scalar value', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Leaf>OLD</Leaf></DIF>')

    const isUpdated = editor.updateLeafNode({
      action: 'replace',
      oldKeywordObject: {
        Value: 'OLD'
      },
      newKeywordObject: {}
    }, {
      nodeXPath: '//DIF/Leaf'
    })

    expect(isUpdated).toBe(true)
    expect(editor.getElementText(editor.selectNodes('//DIF/Leaf')[0])).toBe('')
  })

  test('should create a missing scalar node when the DIF root exists', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Entry_ID/></DIF>')

    const isUpdated = editor.updateScalarNode({
      action: 'replace',
      newKeywordObject: {
        Value: '1A'
      }
    }, {
      nodeXPath: '//DIF/Product_Level_Id',
      tagName: 'Product_Level_Id'
    })

    expect(isUpdated).toBe(true)
    expect(editor.serialize()).toContain('<Product_Level_Id>1A</Product_Level_Id>')
  })
})
