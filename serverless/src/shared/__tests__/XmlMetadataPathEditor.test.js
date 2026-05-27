import {
  describe,
  expect,
  test
} from 'vitest'

import { sequentialReplace, XmlMetadataPathEditor } from '../XmlMetadataPathEditor'

describe('when using XmlMetadataPathEditor path helpers', () => {
  test('should build sequential replace mappings for ordered field paths', () => {
    expect(sequentialReplace(['Category', 'Topic', 'Term'])).toEqual([
      {
        fieldPath: 'Category',
        source: {
          type: 'path',
          pathIndex: 0
        }
      },
      {
        fieldPath: 'Topic',
        source: {
          type: 'path',
          pathIndex: 1
        }
      },
      {
        fieldPath: 'Term',
        source: {
          type: 'path',
          pathIndex: 2
        }
      }
    ])
  })

  test('should normalize keyword path segments with default options', () => {
    expect(XmlMetadataPathEditor.normalizePathSegments('A >  > B')).toEqual(['A', '', 'B'])
  })

  test('should pad trailing find segments to the configured field count', () => {
    expect(XmlMetadataPathEditor.getPathSegmentsForFind('A > B', {
      fieldPaths: ['One', 'Two', 'Three']
    })).toEqual(['A', 'B', ''])
  })

  test('should return null when find configuration is missing', () => {
    expect(XmlMetadataPathEditor.getPathSegmentsForFind('A > B', null)).toBeNull()
  })

  test('should select find segments by position and keep empty fallbacks', () => {
    expect(XmlMetadataPathEditor.getPathSegmentsForFind('A >  > C', {
      segmentPositions: [0, 2, 4]
    })).toEqual(['A', 'C', ''])
  })

  test('should select trailing find segments when requested', () => {
    expect(XmlMetadataPathEditor.getPathSegmentsForFind('A > B > C', {
      takeLastSegments: 2
    })).toEqual(['B', 'C'])
  })

  test('should use default find configuration when it is omitted', () => {
    expect(XmlMetadataPathEditor.getPathSegmentsForFind('A > B')).toEqual(['A', 'B'])
  })
})

describe('when using XmlMetadataPathEditor DOM helpers', () => {
  test('should return no child elements for an undefined node', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Node><A>one</A></Node></DIF>')

    expect(editor.getElementChildren(undefined)).toEqual([])
  })

  test('should build node path segments with default options', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Node><A>one</A><B></B></Node></DIF>')
    const node = editor.selectNodes('//DIF/Node')[0]

    expect(editor.getNodePathSegments(node, ['A', 'B'])).toEqual(['one', ''])
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

  test('should derive replacement values from params and path segments', () => {
    const editor = new XmlMetadataPathEditor('<DIF/>')

    expect(editor.getReplacementValue(
      { newLongName: 'Long Name' },
      {
        type: 'param',
        key: 'newLongName'
      }
    )).toBe('Long Name')

    expect(editor.getReplacementValue(
      { newKeywordPath: '' },
      {
        type: 'path',
        pathIndex: 'last'
      }
    )).toBe('')

    expect(editor.getReplacementValue(
      { newKeywordPath: 'A > B > C' },
      {
        type: 'path',
        pathIndex: 1
      }
    )).toBe('B')

    expect(editor.getReplacementValue(
      { newKeywordPath: 'A >  > C' },
      {
        type: 'path',
        pathIndex: 1
      }
    )).toBe('')

    expect(editor.getReplacementValue(
      { newKeywordPath: 'A > B > C' }
    )).toBe('')
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
      oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      newKeywordPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS'
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
        ]
      },
      replace: [
        {
          fieldPath: 'Category',
          source: {
            type: 'path',
            pathIndex: 0
          }
        },
        {
          fieldPath: 'Topic',
          source: {
            type: 'path',
            pathIndex: 1
          }
        },
        {
          fieldPath: 'Term',
          source: {
            type: 'path',
            pathIndex: 2
          }
        }
      ]
    })

    expect(isUpdated).toBe(true)
    expect(editor.serialize()).toContain('<Topic>OCEANS</Topic>')
    expect(editor.serialize()).toContain('<Term>MARINE SEDIMENTS</Term>')
  })

  test('should invoke afterDelete callbacks for block nodes', () => {
    let callbackNodeName = null
    const editor = new XmlMetadataPathEditor('<DIF><Block><Short_Name>ONE</Short_Name></Block></DIF>')

    const isUpdated = editor.updateBlockNode({
      action: 'delete',
      oldKeywordPath: 'ONE'
    }, {
      nodeXPath: '//DIF/Block',
      find: {
        fieldPaths: ['Short_Name']
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
      oldKeywordPath: 'ONE',
      newKeywordPath: 'TWO'
    }, {
      nodeXPath: '//DIF/Block',
      find: {
        fieldPaths: ['Short_Name']
      },
      replace: [
        {
          fieldPath: 'Short_Name',
          source: {
            type: 'path',
            pathIndex: 0
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

  test('should replace leaf node text with an empty string when the new keyword path is not a string', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Leaf>OLD</Leaf></DIF>')

    const isUpdated = editor.updateLeafNode({
      action: 'replace',
      oldKeywordPath: 'OLD',
      newKeywordPath: null
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
      newKeywordPath: '1A'
    }, {
      nodeXPath: '//DIF/Product_Level_Id',
      tagName: 'Product_Level_Id'
    })

    expect(isUpdated).toBe(true)
    expect(editor.serialize()).toContain('<Product_Level_Id>1A</Product_Level_Id>')
  })
})
