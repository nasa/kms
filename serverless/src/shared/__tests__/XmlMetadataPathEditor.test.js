import {
  describe,
  expect,
  test
} from 'vitest'

import {
  hasAnyObjectValue,
  sequentialValueReplace,
  XmlMetadataPathEditor
} from '../XmlMetadataPathEditor'

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
  test('should treat missing keyword objects as having no meaningful values', () => {
    expect(hasAnyObjectValue(undefined)).toBe(false)
    expect(hasAnyObjectValue({
      Type: '',
      ShortName: 'SPOT-4'
    })).toBe(true)
  })

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
  test('should build ordered node field values with default options', () => {
    const editor = new XmlMetadataPathEditor('<DIF><Node><A>one</A><B></B></Node></DIF>')
    const node = editor.selectNodes('//DIF/Node')[0]

    expect(editor.getNodeFieldValues(node, ['A', 'B'])).toEqual(['one', ''])
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

  describe('outside cases', () => {
    test('should return no child elements for an undefined node', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Node><A>one</A></Node></DIF>')

      expect(editor.getElementChildren(undefined)).toEqual([])
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

      expect(editor.getNestedElement(node, 'Missing/Child')).toBe(null)

      editor.removeNestedElement(node, 'Missing/Child')

      expect(editor.getElementText(editor.selectNodes('//DIF/Node/Child')[0])).toBe('1')
    })

    test('should return null for absolute-path creation when the document root is missing or mismatched', () => {
      const editor = new XmlMetadataPathEditor('<DIF/>')
      const originalSelectNodes = editor.selectNodes

      editor.selectNodes = () => []
      editor.document = { documentElement: null }
      expect(editor.resolveAbsoluteFieldElement('//DIF/ProcessingCenter', { createIfMissing: true })).toBe(null)

      editor.document = new XmlMetadataPathEditor('<DIF/>').document
      expect(editor.resolveAbsoluteFieldElement('//Collection/ProcessingCenter', { createIfMissing: true })).toBe(null)

      editor.selectNodes = originalSelectNodes
    })

    test('should remove empty nodes and return null when block matching has no candidates or no meaningful node values', () => {
      const editor = new XmlMetadataPathEditor(`
        <DIF>
          <EmptyBlock/>
          <NonEmptyBlock>
            <Child>1</Child>
          </NonEmptyBlock>
          <Node>
            <Type></Type>
          </Node>
        </DIF>
      `)

      const emptyBlockNode = editor.selectNodes('//DIF/EmptyBlock')[0]
      const nonEmptyBlockNode = editor.selectNodes('//DIF/NonEmptyBlock')[0]
      editor.removeNodeIfNoElementChildren(emptyBlockNode)
      editor.removeNodeIfNoElementChildren(nonEmptyBlockNode)
      expect(editor.selectNodes('//DIF/EmptyBlock')).toEqual([])
      expect(editor.selectNodes('//DIF/NonEmptyBlock')).toHaveLength(1)

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {
          Type: 'GET DATA'
        }
      }, {
        nodeXPath: '//DIF/Missing',
        find: {
          fieldPaths: ['Type'],
          valueKeys: ['Type']
        }
      })).toBe(null)

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {
          Type: 'GET DATA'
        }
      }, {
        nodeXPath: '//DIF/Node',
        find: {
          fieldPaths: ['Type'],
          valueKeys: ['Type']
        }
      })).toBe(null)
    })

    test('should return null for scalar-style matching when no text node matches the old keyword value', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Leaf>OLD</Leaf></DIF>')

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {
          Value: 'MISSING'
        }
      }, {
        nodeXPath: '//DIF/Leaf'
      })).toBe(null)

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {}
      }, {
        nodeXPath: '//DIF/Leaf'
      })).toBe(null)
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

  describe('for the ECHO10 use cases called out in review', () => {
    test('use case #1 should support absolute document paths for sibling updates', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Node/></DIF>')
      const node = editor.selectNodes('//DIF/Node')[0]

      editor.setNestedText(node, '//DIF/ProcessingCenter', 'NSIDC')
      expect(editor.serialize()).toContain('<ProcessingCenter>NSIDC</ProcessingCenter>')

      editor.removeNestedElement(node, '//DIF/ProcessingCenter')
      expect(editor.selectNodes('//DIF/ProcessingCenter')).toEqual([])

      editor.setNestedText(node, '//Collection/ProcessingCenter', 'NSIDC')
      expect(editor.serialize()).not.toContain('<Collection>')
    })

    test('use case #2 should update only the owned top-level center field when role and current value match', () => {
      const editor = new XmlMetadataPathEditor(`
        <DIF>
          <Organization>
            <Organization_Name>
              <Short_Name>KPDC</Short_Name>
              <Long_Name>Korea Polar Data Center, KOPRI</Long_Name>
            </Organization_Name>
          </Organization>
          <ProcessingCenter>KPDC</ProcessingCenter>
          <ArchiveCenter>ARCHIVE-OWNER</ArchiveCenter>
        </DIF>
      `)

      const isUpdated = editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          BucketLevel0: 'PROCESSOR',
          ShortName: 'KPDC'
        },
        newKeywordObject: {
          BucketLevel0: 'PROCESSOR',
          ShortName: 'NSIDC'
        },
        newLongName: 'National Snow and Ice Data Center'
      }, {
        nodeXPath: '//DIF/Organization',
        find: {
          fieldPaths: ['Organization_Name/Short_Name'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'Organization_Name/Short_Name',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          },
          {
            fieldPath: 'Organization_Name/Long_Name',
            source: {
              type: 'param',
              key: 'newLongName'
            }
          },
          {
            fieldPath: '//DIF/ProcessingCenter',
            condition: ({ correction, editor: currentEditor }) => (
              correction.oldKeywordObject?.BucketLevel0 === 'PROCESSOR'
              && currentEditor.getNestedText(null, '//DIF/ProcessingCenter')
              === correction.oldKeywordObject?.ShortName
            ),
            source: {
              type: 'value',
              key: 'ShortName'
            }
          },
          {
            fieldPath: '//DIF/ArchiveCenter',
            condition: ({ correction, editor: currentEditor }) => (
              correction.oldKeywordObject?.BucketLevel0 === 'ARCHIVER'
              && currentEditor.getNestedText(null, '//DIF/ArchiveCenter')
              === correction.oldKeywordObject?.ShortName
            ),
            source: {
              type: 'value',
              key: 'ShortName'
            }
          }
        ]
      })

      expect(isUpdated).toBe(true)
      expect(editor.serialize()).toContain('<Short_Name>NSIDC</Short_Name>')
      expect(editor.serialize()).toContain('<Long_Name>National Snow and Ice Data Center</Long_Name>')
      expect(editor.serialize()).toContain('<ProcessingCenter>NSIDC</ProcessingCenter>')
      expect(editor.serialize()).toContain('<ArchiveCenter>ARCHIVE-OWNER</ArchiveCenter>')
    })

    test('use case #2 should leave top-level center fields alone when the current value no longer matches the old short name', () => {
      const editor = new XmlMetadataPathEditor(`
        <DIF>
          <Organization>
            <Organization_Name>
              <Short_Name>KPDC</Short_Name>
              <Long_Name>Korea Polar Data Center, KOPRI</Long_Name>
            </Organization_Name>
          </Organization>
          <ProcessingCenter>SOMEONE-ELSE</ProcessingCenter>
          <ArchiveCenter>KPDC</ArchiveCenter>
        </DIF>
      `)

      const isUpdated = editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          BucketLevel0: 'PROCESSOR',
          ShortName: 'KPDC'
        },
        newKeywordObject: {
          BucketLevel0: 'PROCESSOR',
          ShortName: 'NSIDC'
        },
        newLongName: 'National Snow and Ice Data Center'
      }, {
        nodeXPath: '//DIF/Organization',
        find: {
          fieldPaths: ['Organization_Name/Short_Name'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'Organization_Name/Short_Name',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          },
          {
            fieldPath: '//DIF/ProcessingCenter',
            condition: ({ correction, editor: currentEditor }) => (
              correction.oldKeywordObject?.BucketLevel0 === 'PROCESSOR'
              && currentEditor.getNestedText(null, '//DIF/ProcessingCenter')
              === correction.oldKeywordObject?.ShortName
            ),
            source: {
              type: 'value',
              key: 'ShortName'
            }
          }
        ]
      })

      expect(isUpdated).toBe(true)
      expect(editor.serialize()).toContain('<Short_Name>NSIDC</Short_Name>')
      expect(editor.serialize()).toContain('<ProcessingCenter>SOMEONE-ELSE</ProcessingCenter>')
      expect(editor.serialize()).toContain('<ArchiveCenter>KPDC</ArchiveCenter>')
    })

    test('use case #3 should derive replacement values for composed field writes', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Node/></DIF>')
      const targetNode = editor.selectNodes('//DIF/Node')[0]

      expect(editor.getReplacementValue(
        {
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: 'EARTHDATA SEARCH'
          }
        },
        {
          type: 'computed',
          getValue: ({ correction, editor: currentEditor, targetNode: currentTargetNode }) => [
            correction.newKeywordObject.URLContentType,
            correction.newKeywordObject.Type,
            correction.newKeywordObject.Subtype,
            currentEditor.getElementText(currentTargetNode)
          ].filter(Boolean).join(' : ')
        },
        targetNode
      )).toBe('DistributionURL : GET DATA : EARTHDATA SEARCH')
    })

    test('use case #3 should support computed find and replacement values for composed block fields', () => {
      let seenCurrentCombinedValue = null
      const editor = new XmlMetadataPathEditor(`
        <Collection>
          <OnlineResource>
            <Type>DistributionURL : GET DATA : GIOVANNI</Type>
          </OnlineResource>
          <OnlineResource>
            <Type>CollectionURL : VIEW PROJECT HOME PAGE</Type>
          </OnlineResource>
        </Collection>
      `)

      const isUpdated = editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          URLContentType: 'DistributionURL',
          Type: 'GET DATA',
          Subtype: 'GIOVANNI'
        },
        newKeywordObject: {
          URLContentType: 'DistributionURL',
          Type: 'GET DATA',
          Subtype: 'EARTHDATA SEARCH'
        }
      }, {
        nodeXPath: '//Collection/OnlineResource',
        find: {
          fieldPaths: ['Type'],
          valueKeys: ['CombinedType'],
          getExpectedValueObject: ({ correction }) => ({
            CombinedType: [
              correction.oldKeywordObject?.URLContentType,
              correction.oldKeywordObject?.Type,
              correction.oldKeywordObject?.Subtype
            ].filter(Boolean).join(' : ')
          }),
          getNodeValueObject: ({ node, editor: currentEditor }) => ({
            CombinedType: currentEditor.getNestedText(node, 'Type')
          })
        },
        replace: [
          {
            fieldPath: 'Type',
            source: {
              type: 'computed',
              getValue: ({ correction, editor: currentEditor, targetNode }) => {
                seenCurrentCombinedValue = currentEditor.getNestedText(targetNode, 'Type')

                return [
                  correction.newKeywordObject?.URLContentType,
                  correction.newKeywordObject?.Type,
                  correction.newKeywordObject?.Subtype
                ].filter(Boolean).join(' : ')
              }
            }
          }
        ]
      })

      expect(isUpdated).toBe(true)
      expect(seenCurrentCombinedValue).toBe('DistributionURL : GET DATA : GIOVANNI')
      expect(editor.serialize()).toContain(
        '<Type>DistributionURL : GET DATA : EARTHDATA SEARCH</Type>'
      )

      expect(editor.serialize()).toContain(
        '<Type>CollectionURL : VIEW PROJECT HOME PAGE</Type>'
      )
    })
  })

  describe('outside cases', () => {
    test('should default field conditions to true and honor condition callbacks when provided', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Node/></DIF>')
      const targetNode = editor.selectNodes('//DIF/Node')[0]
      let seenTargetNodeName = null
      let sawNullTargetNode = false

      expect(editor.shouldApplyFieldCondition({}, undefined, targetNode)).toBe(true)

      expect(editor.shouldApplyFieldCondition({
        oldKeywordObject: {
          ShortName: 'KPDC'
        }
      }, ({ correction, editor: currentEditor, targetNode: currentTargetNode }) => {
        seenTargetNodeName = currentTargetNode.nodeName

        return correction.oldKeywordObject?.ShortName === 'KPDC'
          && currentEditor === editor
      }, targetNode)).toBe(true)

      expect(seenTargetNodeName).toBe('Node')
      expect(editor.shouldApplyFieldCondition({}, ({ targetNode: currentTargetNode }) => {
        sawNullTargetNode = currentTargetNode === null

        return true
      })).toBe(true)

      expect(sawNullTargetNode).toBe(true)
      expect(editor.shouldApplyFieldCondition({}, () => false, targetNode)).toBe(false)
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

    test('should use tagName to create a missing scalar node when the DIF root exists', () => {
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

    test('should default block updates to replace and allow deletes without callbacks', () => {
      const replaceEditor = new XmlMetadataPathEditor('<DIF><Block><Short_Name>ONE</Short_Name></Block></DIF>')
      const deleteEditor = new XmlMetadataPathEditor('<DIF><Block><Short_Name>ONE</Short_Name></Block></DIF>')

      expect(replaceEditor.updateBlockNode({
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
        ]
      })).toBe(true)

      expect(replaceEditor.serialize()).toContain('<Short_Name>TWO</Short_Name>')

      expect(deleteEditor.updateBlockNode({
        action: 'delete',
        oldKeywordObject: {
          ShortName: 'ONE'
        }
      }, {
        nodeXPath: '//DIF/Block',
        find: {
          fieldPaths: ['Short_Name'],
          valueKeys: ['ShortName']
        }
      })).toBe(true)

      expect(deleteEditor.selectNodes('//DIF/Block')).toEqual([])
    })

    test('should return false when block updates do not match a node or use an unsupported action', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Block><Short_Name>ONE</Short_Name></Block></DIF>')

      expect(editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'MISSING'
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
        ]
      })).toBe(false)

      expect(editor.updateBlockNode({
        action: 'noop',
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
        ]
      })).toBe(false)
    })

    test('should remove block nodes when replace leaves them empty and pruning is enabled', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Block><Short_Name>ONE</Short_Name></Block></DIF>')

      const isUpdated = editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'ONE'
        },
        newKeywordObject: {}
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
        removeNodeIfEmptyAfterReplace: true
      })

      expect(isUpdated).toBe(true)
      expect(editor.selectNodes('//DIF/Block')).toEqual([])
    })

    test('should replace leaf node text with an empty string when the new keyword object has no scalar value', () => {
      const editor = new XmlMetadataPathEditor('<DIF><Leaf>OLD</Leaf></DIF>')

      const isUpdated = editor.updateLeafNode({
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

    test('should delete leaf nodes and prune empty parents when configured, and return false for unmatched or unsupported actions', () => {
      const editor = new XmlMetadataPathEditor(`
        <DIF>
          <Data_Resolution>
            <Horizontal_Resolution_Range>1</Horizontal_Resolution_Range>
          </Data_Resolution>
        </DIF>
      `)

      expect(editor.updateLeafNode({
        action: 'replace',
        oldKeywordObject: {
          Value: 'MISSING'
        },
        newKeywordObject: {
          Value: 'NEXT'
        }
      }, {
        nodeXPath: '//DIF/MissingLeaf'
      })).toBe(false)

      const isDeleted = editor.updateLeafNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1'
        }
      }, {
        nodeXPath: '//DIF/Data_Resolution/Horizontal_Resolution_Range',
        removeEmptyParent: true
      })

      expect(isDeleted).toBe(true)
      expect(editor.selectNodes('//DIF/Data_Resolution')).toEqual([])

      const unsupportedActionEditor = new XmlMetadataPathEditor('<DIF><Leaf>OLD</Leaf></DIF>')
      expect(unsupportedActionEditor.updateLeafNode({
        action: 'noop',
        oldKeywordObject: {
          Value: 'OLD'
        },
        newKeywordObject: {
          Value: 'OTHER'
        }
      }, {
        nodeXPath: '//DIF/Leaf'
      })).toBe(false)

      const deleteWithoutParentPruneEditor = new XmlMetadataPathEditor(`
        <DIF>
          <Data_Resolution>
            <Horizontal_Resolution_Range>1</Horizontal_Resolution_Range>
          </Data_Resolution>
        </DIF>
      `)

      expect(deleteWithoutParentPruneEditor.updateLeafNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1'
        }
      }, {
        nodeXPath: '//DIF/Data_Resolution/Horizontal_Resolution_Range'
      })).toBe(true)

      expect(deleteWithoutParentPruneEditor.selectNodes('//DIF/Data_Resolution')).toHaveLength(1)
    })

    test.only('should support scalar delete paths and return false when scalar updates are unsupported or cannot create a root field', () => {
      const deleteEditor = new XmlMetadataPathEditor('<DIF><Product_Level_Id>1A</Product_Level_Id></DIF>')
      const defaultReplaceEditor = new XmlMetadataPathEditor('<DIF><Product_Level_Id>1A</Product_Level_Id></DIF>')
      const missingDeleteEditor = new XmlMetadataPathEditor('<DIF><Entry_ID/></DIF>')
      const missingReplaceEditor = new XmlMetadataPathEditor('<DIF></DIF>')
      const missingRootEditor = new XmlMetadataPathEditor('<Collection/>')

      expect(missingDeleteEditor.updateScalarNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1A'
        }
      }, {
        nodeXPath: '//DIF/Product_Level_Id',
        tagName: 'Product_Level_Id'
      })).toBe(false)

      expect(deleteEditor.updateScalarNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1A'
        }
      }, {
        nodeXPath: '//DIF/Product_Level_Id',
        tagName: 'Product_Level_Id'
      })).toBe(true)

      expect(deleteEditor.selectNodes('//DIF/Product_Level_Id')).toEqual([])

      expect(defaultReplaceEditor.updateScalarNode({
        newKeywordObject: {
          Value: '1B'
        }
      }, {
        nodeXPath: '//DIF/Product_Level_Id',
        tagName: 'Product_Level_Id'
      })).toBe(true)

      expect(defaultReplaceEditor.getElementText(
        defaultReplaceEditor.selectNodes('//DIF/Product_Level_Id')[0]
      )).toBe('1B')

      expect(missingRootEditor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Value: '1A'
        }
      }, {
        nodeXPath: '//DIF/Product_Level_Id',
        tagName: 'Product_Level_Id'
      })).toBe(false)

      expect(missingRootEditor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Value: '1A'
        }
      }, {
        nodeXPath: '//Collection/ProductLevelId',
        tagName: 'ProductLevelId'
      })).toBe(true)

      expect(missingReplaceEditor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Value: '1A'
        }
      }, {
        nodeXPath: '//DIF/Product_Level_Id',
        tagName: 'Product_Level_Id'
      })).toBe(true)

      expect(deleteEditor.updateScalarNode({
        action: 'noop',
        newKeywordObject: {
          Value: '1B'
        }
      }, {
        nodeXPath: '//DIF/Product_Level_Id',
        tagName: 'Product_Level_Id'
      })).toBe(false)
    })
  })
})
