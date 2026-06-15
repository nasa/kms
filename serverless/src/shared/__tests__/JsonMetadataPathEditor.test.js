import {
  describe,
  expect,
  test
} from 'vitest'

import {
  hasAnyObjectValue,
  JsonMetadataPathEditor,
  sequentialValueReplace
} from '../JsonMetadataPathEditor'

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

const verifyJsonOnlyTraversalCoverage = () => {
  const editor = new JsonMetadataPathEditor({
    Platforms: [
      {
        ShortName: 'Aqua'
      }
    ],
    MetadataSpecification: {
      Enabled: true,
      Count: 7
    },
    CollectionDataType: 'legacy'
  })

  expect(editor.selectNodes({})).toEqual([])
  expect(editor.selectNodes('')).toEqual([editor.document])
  expect(editor.selectNodes('//Missing')).toEqual([])
  expect(editor.selectNodes(['Platforms', '0', 'ShortName'])).toEqual([])
  expect(editor.selectNodes('//Platforms/0/ShortName')).toEqual(['Aqua'])
  expect(editor.resolveNodeEntryByPath('')).toBeNull()
  expect(editor.resolveNodeEntryByPath(['Platforms', 0])).toBeNull()
  expect(new JsonMetadataPathEditor(undefined).selectNodeEntries('//Missing')).toEqual([])

  expect(editor.getElementChildren(editor.document.Platforms)).toEqual([
    {
      ShortName: 'Aqua'
    }
  ])

  expect(editor.getDirectChildElement(editor.document.Platforms, 0)).toEqual({
    ShortName: 'Aqua'
  })

  expect(editor.getDirectChildElement(editor.document.Platforms, '0')).toBeNull()
  expect(editor.getDirectChildElement(editor.document.Platforms, 9)).toBeNull()
  expect(editor.getElementText(editor.document.MetadataSpecification.Enabled)).toBe('true')
  expect(editor.getElementText(editor.document.MetadataSpecification.Count)).toBe('7')
  expect(editor.getElementText(editor.document.MetadataSpecification)).toBe('')
  expect(editor.getNestedElement(editor.document, ['Platforms', 0, 'ShortName'])).toBeNull()
  expect(editor.getNestedElement(editor.document, '//Platforms/0/ShortName')).toBe('Aqua')
  expect(editor.getNestedText(editor.document, 'Platforms/0/ShortName')).toBe('Aqua')
  expect(editor.resolveNodeEntryByPath('//CollectionDataType/Extra')).toBeNull()
  expect(editor.resolveNodeEntryByPath('//Platforms/5')).toBeNull()

  expect(editor.resolveAbsoluteFieldEntry('//')).toBeNull()
  expect(editor.resolveAbsoluteFieldEntry('//Platforms')).toMatchObject({
    node: editor.document.Platforms,
    key: 'Platforms'
  })

  expect(editor.resolveAbsoluteFieldEntry('//Platforms/0/ShortName')).toMatchObject({
    node: 'Aqua',
    parent: editor.document.Platforms[0],
    key: 'ShortName'
  })

  expect(editor.resolveAbsoluteFieldEntry('//ProcessingLevel/Id')).toBeNull()
  expect(editor.resolveAbsoluteFieldEntry('//ProcessingLevel/Id', { createIfMissing: true })).toBeNull()
  expect(new JsonMetadataPathEditor(undefined).resolveNodeEntryByPath('//Missing')).toBeNull()
}

const verifyJsonOnlyMutationCoverage = () => {
  const editor = new JsonMetadataPathEditor({
    Platforms: [
      {
        ShortName: 'Aqua'
      }
    ],
    CollectionDataType: 'legacy'
  })

  editor.setNestedText(editor.document, 'ContactPersons/0/FirstName', 'Terra')
  expect(editor.document.ContactPersons).toEqual([
    {
      FirstName: 'Terra'
    }
  ])

  editor.setNestedText('legacy', 'Name', 'ignored')
  editor.setNestedText(editor.document, '', 'ignored')
  editor.setNestedText(editor.document.Platforms, 'bad/path', 'ignored')
  editor.setNestedText(editor.document, ['ContactPersons', 0, 'LastName'], 'ignored')

  expect(editor.document.Platforms).toEqual([
    {
      ShortName: 'Aqua'
    }
  ])

  editor.removeNestedElement('legacy', 'Name')
  editor.removeNestedElement(editor.document, '')
  editor.removeNestedElement(editor.document, ['Platforms', 0, 'ShortName'])
  expect(editor.document.CollectionDataType).toBe('legacy')

  expect(editor.resolveNodeByFind({}, {
    nodePath: '//Platforms/0'
  })).toEqual({
    ShortName: 'Aqua'
  })

  expect(editor.resolveNodeByFind({
    ummPath: '//Platforms/0'
  }, {})).toBeNull()

  expect(editor.resolveNodeByFind({
    ummPath: ['Platforms', 0]
  }, {})).toBeNull()

  expect(editor.ensureEntryForSegments('legacy', ['Name'])).toBeNull()
  expect(editor.ensureEntryForSegments(editor.document.Platforms, [0])).toMatchObject({
    node: {
      ShortName: 'Aqua'
    },
    key: 0
  })

  const createdArrayContainer = []

  expect(editor.ensureEntryForSegments(createdArrayContainer, [0, 0])).toMatchObject({
    parent: createdArrayContainer[0],
    key: 0
  })

  expect(createdArrayContainer).toEqual([[]])

  const existingArrayContainer = [[
    {
      ShortName: 'Terra'
    }
  ]]

  expect(editor.ensureEntryForSegments(existingArrayContainer, [0, 0])).toMatchObject({
    node: {
      ShortName: 'Terra'
    },
    parent: existingArrayContainer[0],
    key: 0
  })

  const createdObjectContainer = {}

  expect(editor.ensureEntryForSegments(createdObjectContainer, ['Parent', 'Child'])).toMatchObject({
    parent: createdObjectContainer.Parent,
    key: 'Child'
  })

  expect(createdObjectContainer).toEqual({
    Parent: {}
  })

  const existingObjectContainer = {
    Parent: {
      Child: 'legacy'
    }
  }

  expect(editor.ensureEntryForSegments(existingObjectContainer, ['Parent', 'Child'])).toMatchObject({
    node: 'legacy',
    parent: existingObjectContainer.Parent,
    key: 'Child'
  })

  expect(editor.ensureEntryForSegments({}, [])).toBeNull()

  const arrayParent = ['Aqua']
  editor.removeEntry({
    parent: arrayParent,
    key: 5
  })

  expect(arrayParent).toEqual(['Aqua'])

  editor.removeEntry({
    parent: arrayParent,
    key: 0
  })

  expect(arrayParent).toEqual([])

  editor.setEntryValue(null, 'ignored')
  editor.removeEntry(null)

  expect(editor.updateScalarNode({
    action: 'replace',
    newKeywordObject: {
      Value: 'Level 2'
    }
  }, {
    nodePath: ['ProcessingLevel', 'Id']
  })).toBe(false)
}

describe('when using JsonMetadataPathEditor object helpers', () => {
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

describe('when using JsonMetadataPathEditor JSON helpers', () => {
  test('should build ordered node field values with default options', () => {
    const editor = new JsonMetadataPathEditor({
      Platforms: [
        {
          Type: 'Space-based Platforms',
          ShortName: ''
        }
      ]
    })
    const node = editor.selectNodes('//Platforms')[0]

    expect(editor.getNodeFieldValues(node, ['Type', 'ShortName'])).toEqual([
      'Space-based Platforms',
      ''
    ])
  })

  test('should derive replacement values from params and keyword objects', () => {
    const editor = new JsonMetadataPathEditor({
      RelatedUrls: [
        {
          Description: 'DistributionURL : GET DATA : GIOVANNI'
        }
      ]
    })
    const targetNode = editor.selectNodes('//RelatedUrls')[0]

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
          currentEditor.getElementText(currentTargetNode.Description)
        ].filter(Boolean).join(' : ')
      },
      targetNode
    )).toBe('DistributionURL : GET DATA : EARTHDATA SEARCH : DistributionURL : GET DATA : GIOVANNI')

    expect(editor.getReplacementValue(
      { newKeywordObject: { Type: 'B' } }
    )).toBe('')
  })

  test('should derive replacement values from canonical keyword objects', () => {
    const editor = new JsonMetadataPathEditor({
      ScienceKeywords: []
    })

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

  describe('for the ECHO10 use cases called out in review', () => {
    test('use case #1 should support absolute document paths for sibling updates', () => {
      const editor = new JsonMetadataPathEditor({
        Platforms: [
          {
            ShortName: 'Aqua'
          }
        ],
        ProcessingLevel: {
          Id: 'L1'
        }
      })
      const node = editor.selectNodes('//Platforms')[0]

      editor.setNestedText(node, '//ProcessingLevel/Id', 'L2')
      expect(editor.selectNodes('//ProcessingLevel/Id')).toEqual(['L2'])

      editor.removeNestedElement(node, '//ProcessingLevel/Id')
      expect(editor.selectNodes('//ProcessingLevel/Id')).toEqual([])

      editor.setNestedText(node, '//ProcessingLevel/Id', 'L2')
      expect(editor.selectNodes('//ProcessingLevel/Id')).toEqual(['L2'])
    })

    test('use case #3 should derive replacement values for composed field writes', () => {
      const editor = new JsonMetadataPathEditor({
        RelatedUrls: [
          {
            Description: ''
          }
        ]
      })
      const targetNode = editor.selectNodes('//RelatedUrls')[0]

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
            currentEditor.getElementText(currentTargetNode.Description)
          ].filter(Boolean).join(' : ')
        },
        targetNode
      )).toBe('DistributionURL : GET DATA : EARTHDATA SEARCH')
    })
  })

  describe('outside cases', () => {
    test('should return no child elements for an undefined node', () => {
      const editor = new JsonMetadataPathEditor({
        Projects: [
          {
            ShortName: 'Legacy Project'
          }
        ]
      })

      expect(editor.getElementChildren(undefined)).toEqual([])
    })

    test('should remove direct nested elements and ignore detached nodes', () => {
      const editor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: 'L1',
          Description: 'Processing level'
        }
      })
      const node = editor.selectNodes('//ProcessingLevel')[0]
      const detached = {}

      editor.removeNestedElement(node, 'Description')
      editor.removeNestedElement(detached, 'Detached')

      expect(editor.selectNodes('//ProcessingLevel/Description')).toEqual([])
    })

    test('should ignore nested removals when the intermediate parent path does not exist', () => {
      const editor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: 'L1'
        }
      })
      const node = editor.selectNodes('//ProcessingLevel')[0]

      expect(editor.getNestedElement(node, 'Missing/Child')).toBeNull()

      editor.removeNestedElement(node, 'Missing/Child')

      expect(editor.getElementText(editor.selectNodes('//ProcessingLevel/Id')[0])).toBe('L1')
    })

    test('should return null for absolute-path creation when the document root is missing or mismatched', () => {
      const primitiveRootEditor = new JsonMetadataPathEditor('legacy')
      const mismatchEditor = new JsonMetadataPathEditor({
        Platforms: []
      })

      primitiveRootEditor.setNestedText('legacy', '//ProcessingLevel/Id', 'L1')
      expect(primitiveRootEditor.document).toBe('legacy')

      mismatchEditor.setNestedText(mismatchEditor.document.Platforms, '//ProcessingLevel/Id', 'L1')
      expect(mismatchEditor.selectNodes('//ProcessingLevel/Id')).toEqual([])

      verifyJsonOnlyTraversalCoverage()
    })

    test('should remove empty nodes and return null when block matching has no candidates or no meaningful node values', () => {
      const editor = new JsonMetadataPathEditor({
        MetadataSpecification: {},
        ProcessingLevel: {
          Id: 'L1'
        },
        RelatedUrls: [
          {
            Type: ''
          }
        ]
      })

      const emptyBlockNode = editor.selectNodes('//MetadataSpecification')[0]
      const nonEmptyBlockNode = editor.selectNodes('//ProcessingLevel')[0]

      expect(editor.getElementChildren(emptyBlockNode)).toEqual([])
      expect(editor.getElementChildren(nonEmptyBlockNode)).toEqual(['L1'])

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {
          Type: 'GET DATA'
        }
      }, {
        nodePath: '//Missing',
        find: {
          fieldPaths: ['Type'],
          valueKeys: ['Type']
        }
      })).toBeNull()

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {
          Type: 'GET DATA'
        }
      }, {
        nodePath: '//RelatedUrls',
        find: {
          fieldPaths: ['Type'],
          valueKeys: ['Type']
        }
      })).toBeNull()
    })

    test('should return null for scalar-style matching when no text node matches the old keyword value', () => {
      const editor = new JsonMetadataPathEditor({
        EntryTitle: 'OLD'
      })

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {
          Value: 'MISSING'
        }
      }, {
        nodePath: '//EntryTitle'
      })).toBeNull()

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {}
      }, {
        nodePath: '//EntryTitle'
      })).toBeNull()
    })

    test('should fall back to fieldPaths and empty scalar keyword text when optional values are absent', () => {
      const editor = new JsonMetadataPathEditor({
        Platforms: [
          {
            Type: 'Space-based Platforms',
            ShortName: 'Aqua'
          },
          {
            Type: 'Air-based Platforms',
            ShortName: 'HU-25A'
          }
        ]
      })

      expect(editor.resolveNodeByFind({
        oldKeywordObject: {}
      }, {
        nodePath: '//Platforms',
        find: {
          fieldPaths: ['Type', 'ShortName']
        }
      })).toBeNull()

      expect(editor.updateScalarNode({
        action: 'replace'
      }, {
        nodePath: '//MissingField',
        tagName: 'MissingField'
      })).toBe(false)
    })

    test('should fall back to the first non-empty object value for scalar replacements', () => {
      const editor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: 'Legacy'
        }
      })

      expect(editor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Alias: 'Level 1A'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })).toBe(true)

      expect(editor.getElementText(editor.selectNodes('//ProcessingLevel/Id')[0])).toBe('Level 1A')
      verifyJsonOnlyMutationCoverage()
    })
  })
})

describe('when updating JSON nodes through JsonMetadataPathEditor', () => {
  test('should match a shorter correction path against a padded UMM-C hierarchy', () => {
    const editor = new JsonMetadataPathEditor({
      ScienceKeywords: [
        {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS'
        }
      ]
    })

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
      nodePath: '//ScienceKeywords',
      find: {
        fieldPaths: [
          'Category',
          'Topic',
          'Term',
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
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
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
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
    expect(editor.serialize()).toContain('"Topic": "OCEANS"')
    expect(editor.serialize()).toContain('"Term": "MARINE SEDIMENTS"')
  })

  test('should match and update block nodes in UMM-C payloads with native field names', () => {
    const editor = new JsonMetadataPathEditor({
      ScienceKeywords: [
        {
          Category: 'EARTH SCIENCE',
          Topic: 'CRYOSPHERE',
          Term: 'SNOW/ICE'
        }
      ]
    })

    const isUpdated = editor.updateBlockNode({
      action: 'replace',
      oldKeywordObject: CRYOSPHERE_SNOW_ICE_TERM_KEYWORD,
      newKeywordObject: CRYOSPHERE_SNOW_ICE_RENAMED_TERM_KEYWORD
    }, {
      nodePath: '//ScienceKeywords',
      find: {
        fieldPaths: [
          'Category',
          'Topic',
          'Term',
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
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
          'VariableLevel1',
          'VariableLevel2',
          'VariableLevel3',
          'DetailedVariable'
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
    expect(editor.serialize()).toContain('"Term": "SNOW/ICE - chris v5"')
  })

  describe('for the ECHO10 use cases called out in review', () => {
    test('use case #1 should support absolute replace field paths outside the matched block node', () => {
      const editor = new JsonMetadataPathEditor({
        DataCenters: [
          {
            ShortName: 'KPDC',
            LongName: 'Korea Polar Data Center, KOPRI'
          }
        ],
        ProcessingLevel: {
          Id: 'KPDC'
        },
        CollectionDataType: 'KPDC'
      })

      const isUpdated = editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'KPDC'
        },
        newKeywordObject: {
          ShortName: 'NSIDC'
        },
        newLongName: 'National Snow and Ice Data Center'
      }, {
        nodePath: '//DataCenters',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'ShortName',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          },
          {
            fieldPath: 'LongName',
            source: {
              type: 'param',
              key: 'newLongName'
            }
          },
          {
            fieldPath: '//ProcessingLevel/Id',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          },
          {
            fieldPath: '//CollectionDataType',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          }
        ]
      })

      expect(isUpdated).toBe(true)
      expect(editor.serialize()).toContain('"ShortName": "NSIDC"')
      expect(editor.serialize()).toContain('"LongName": "National Snow and Ice Data Center"')
      expect(editor.serialize()).toContain('"Id": "NSIDC"')
      expect(editor.serialize()).toContain('"CollectionDataType": "NSIDC"')
    })

    test('use case #3 should support computed find and replacement values for composed block fields', () => {
      let seenCurrentCombinedValue = null
      const editor = new JsonMetadataPathEditor({
        RelatedUrls: [
          {
            Description: 'DistributionURL : GET DATA : GIOVANNI'
          },
          {
            Description: 'CollectionURL : VIEW PROJECT HOME PAGE'
          }
        ]
      })

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
        nodePath: '//RelatedUrls',
        find: {
          fieldPaths: ['Description'],
          valueKeys: ['CombinedType'],
          getExpectedValueObject: ({ correction }) => ({
            CombinedType: [
              correction.oldKeywordObject?.URLContentType,
              correction.oldKeywordObject?.Type,
              correction.oldKeywordObject?.Subtype
            ].filter(Boolean).join(' : ')
          }),
          getNodeValueObject: ({ node, editor: currentEditor }) => ({
            CombinedType: currentEditor.getNestedText(node, 'Description')
          })
        },
        replace: [
          {
            fieldPath: 'Description',
            source: {
              type: 'computed',
              getValue: ({ correction, editor: currentEditor, targetNode }) => {
                seenCurrentCombinedValue = currentEditor.getNestedText(targetNode, 'Description')

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
        '"Description": "DistributionURL : GET DATA : EARTHDATA SEARCH"'
      )

      expect(editor.serialize()).toContain(
        '"Description": "CollectionURL : VIEW PROJECT HOME PAGE"'
      )
    })
  })

  describe('outside cases', () => {
    test('should update nested block nodes using the shared JSON root path contract', () => {
      const editor = new JsonMetadataPathEditor({
        Platforms: [
          {
            ShortName: 'Aqua',
            Instruments: [
              {
                ShortName: 'MODIS',
                LongName: 'Legacy MODIS'
              }
            ]
          }
        ]
      })

      const isUpdated = editor.updateNestedBlockNode({
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'MODIS'
        },
        newKeywordObject: {
          ShortName: 'MODIS-TERRA'
        },
        newLongName: ''
      }, {
        containerPath: '//Platforms',
        childKey: 'Instruments',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'ShortName',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          },
          {
            fieldPath: 'LongName',
            source: {
              type: 'param',
              key: 'newLongName'
            }
          }
        ]
      })

      expect(isUpdated).toBe(true)
      expect(editor.document.Platforms[0].Instruments[0]).toEqual({
        ShortName: 'MODIS-TERRA'
      })
    })

    test('should delete nested block nodes, prune empty child arrays, and call afterDelete once', () => {
      let afterDeleteCallCount = 0
      const editor = new JsonMetadataPathEditor({
        Platforms: [
          {
            ShortName: 'Aqua',
            Instruments: [
              {
                ShortName: 'MODIS'
              }
            ]
          }
        ]
      })

      const isUpdated = editor.updateNestedBlockNode({
        action: 'delete',
        oldKeywordObject: {
          ShortName: 'MODIS'
        }
      }, {
        containerPath: '//Platforms',
        childKey: 'Instruments',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [],
        afterDelete: () => {
          afterDeleteCallCount += 1
        }
      })

      expect(isUpdated).toBe(true)
      expect(afterDeleteCallCount).toBe(1)
      expect(editor.document.Platforms[0].Instruments).toBeUndefined()
    })

    test('should return false for unsupported nested block actions and missing nested correction keys', () => {
      const editor = new JsonMetadataPathEditor({
        Platforms: [
          {
            ShortName: 'Aqua',
            Instruments: [
              {
                ShortName: 'MODIS'
              }
            ]
          }
        ]
      })

      expect(editor.updateNestedBlockNode({
        action: 'noop',
        oldKeywordObject: {
          ShortName: 'MODIS'
        }
      }, {
        containerPath: '//Platforms',
        childKey: 'Instruments',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: []
      })).toBe(false)

      expect(editor.updateNestedBlockNode({
        action: 'replace'
      }, {
        containerPath: '//Platforms',
        childKey: 'Instruments',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: []
      })).toBe(false)
    })

    test('should invoke afterDelete callbacks for block nodes', () => {
      let callbackNodeName = null
      const editor = new JsonMetadataPathEditor({
        Projects: [
          {
            ShortName: 'ONE'
          }
        ]
      })

      const isUpdated = editor.updateBlockNode({
        action: 'delete',
        oldKeywordObject: {
          ShortName: 'ONE'
        }
      }, {
        nodePath: '//Projects',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        afterDelete: (_, targetNode) => {
          callbackNodeName = targetNode.ShortName
        }
      })

      expect(isUpdated).toBe(true)
      expect(callbackNodeName).toBe('ONE')
      expect(editor.selectNodes('//Projects')).toEqual([])
    })

    test('should invoke afterDelete callbacks for leaf and scalar deletes', () => {
      const leafEditor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: '1'
        }
      })
      const scalarEditor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: '1A'
        }
      })
      let deletedLeafValue = null
      let deletedScalarValue = null

      expect(leafEditor.updateLeafNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        afterDelete: (_, deletedValue) => {
          deletedLeafValue = deletedValue
        }
      })).toBe(true)

      expect(scalarEditor.updateScalarNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1A'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id',
        afterDelete: (_, deletedValue) => {
          deletedScalarValue = deletedValue
        }
      })).toBe(true)

      expect(deletedLeafValue).toBe('1')
      expect(deletedScalarValue).toBe('1A')
    })

    test('should invoke afterReplace callbacks for block nodes', () => {
      let callbackNodeName = null
      const editor = new JsonMetadataPathEditor({
        Projects: [
          {
            ShortName: 'ONE'
          }
        ]
      })

      const isUpdated = editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'ONE'
        },
        newKeywordObject: {
          ShortName: 'TWO'
        }
      }, {
        nodePath: '//Projects',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'ShortName',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          }
        ],
        afterReplace: (_, targetNode) => {
          callbackNodeName = targetNode.ShortName
        }
      })

      expect(isUpdated).toBe(true)
      expect(callbackNodeName).toBe('TWO')
      expect(editor.serialize()).toContain('"ShortName": "TWO"')
    })

    test('should use absolute scalar paths to create a missing UMM-C field when the root exists', () => {
      const editor = new JsonMetadataPathEditor({
        ProcessingLevel: {}
      })

      const isUpdated = editor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Value: '1A'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })

      expect(isUpdated).toBe(true)
      expect(editor.serialize()).toContain('"Id": "1A"')
    })

    test('should default block updates to replace and allow deletes without callbacks', () => {
      const replaceEditor = new JsonMetadataPathEditor({
        Projects: [
          {
            ShortName: 'ONE'
          }
        ]
      })
      const deleteEditor = new JsonMetadataPathEditor({
        Projects: [
          {
            ShortName: 'ONE'
          }
        ]
      })

      expect(replaceEditor.updateBlockNode({
        oldKeywordObject: {
          ShortName: 'ONE'
        },
        newKeywordObject: {
          ShortName: 'TWO'
        }
      }, {
        nodePath: '//Projects',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'ShortName',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          }
        ]
      })).toBe(true)

      expect(replaceEditor.serialize()).toContain('"ShortName": "TWO"')

      expect(deleteEditor.updateBlockNode({
        action: 'delete',
        oldKeywordObject: {
          ShortName: 'ONE'
        }
      }, {
        nodePath: '//Projects',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        }
      })).toBe(true)

      expect(deleteEditor.selectNodes('//Projects')).toEqual([])
    })

    test('should return false when block updates do not match a node or use an unsupported action', () => {
      const editor = new JsonMetadataPathEditor({
        Projects: [
          {
            ShortName: 'ONE'
          }
        ]
      })

      expect(editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'MISSING'
        },
        newKeywordObject: {
          ShortName: 'TWO'
        }
      }, {
        nodePath: '//Projects',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'ShortName',
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
        nodePath: '//Projects',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'ShortName',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          }
        ]
      })).toBe(false)
    })

    test('should remove block nodes when replace leaves them empty and pruning is enabled', () => {
      const editor = new JsonMetadataPathEditor({
        Projects: [
          {
            ShortName: 'ONE'
          }
        ]
      })

      const isUpdated = editor.updateBlockNode({
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'ONE'
        },
        newKeywordObject: {}
      }, {
        nodePath: '//Projects',
        find: {
          fieldPaths: ['ShortName'],
          valueKeys: ['ShortName']
        },
        replace: [
          {
            fieldPath: 'ShortName',
            source: {
              type: 'value',
              key: 'ShortName'
            }
          }
        ],
        removeNodeIfEmptyAfterReplace: true
      })

      expect(isUpdated).toBe(true)
      expect(editor.selectNodes('//Projects')).toEqual([])
    })

    test('should replace leaf node text with an empty string when the new keyword object has no scalar value', () => {
      const editor = new JsonMetadataPathEditor({
        ISOTopicCategories: [
          'EARTH SCIENCE SERVICES'
        ]
      })

      const isUpdated = editor.updateLeafNode({
        oldKeywordObject: {
          Value: 'EARTH SCIENCE SERVICES'
        },
        newKeywordObject: {}
      }, {
        nodePath: '//ISOTopicCategories'
      })

      expect(isUpdated).toBe(true)
      expect(editor.getElementText(editor.selectNodes('//ISOTopicCategories')[0])).toBe('')
    })

    test('should delete leaf nodes and prune empty parents when configured, and return false for unmatched or unsupported actions', () => {
      const editor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: '1'
        }
      })

      expect(editor.updateLeafNode({
        action: 'replace',
        oldKeywordObject: {
          Value: 'MISSING'
        },
        newKeywordObject: {
          Value: 'NEXT'
        }
      }, {
        nodePath: '//MissingLeaf'
      })).toBe(false)

      const isDeleted = editor.updateLeafNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        removeEmptyParent: true
      })

      expect(isDeleted).toBe(true)
      expect(editor.selectNodes('//ProcessingLevel')).toEqual([])

      const unsupportedActionEditor = new JsonMetadataPathEditor({
        ISOTopicCategories: [
          'OLD'
        ]
      })

      expect(unsupportedActionEditor.updateLeafNode({
        action: 'noop',
        oldKeywordObject: {
          Value: 'OLD'
        },
        newKeywordObject: {
          Value: 'OTHER'
        }
      }, {
        nodePath: '//ISOTopicCategories'
      })).toBe(false)

      const deleteWithoutParentPruneEditor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: '1'
        }
      })

      expect(deleteWithoutParentPruneEditor.updateLeafNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1'
        }
      }, {
        nodePath: '//ProcessingLevel/Id'
      })).toBe(true)

      expect(deleteWithoutParentPruneEditor.selectNodes('//ProcessingLevel')).toHaveLength(1)

      const unresolvedParentEditor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: '1'
        }
      })

      expect(unresolvedParentEditor.updateLeafNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        removeEmptyParent: true,
        parentPath: '//MissingParent'
      })).toBe(true)

      expect(unresolvedParentEditor.document.ProcessingLevel).toEqual({})
    })

    test('should support scalar delete paths and return false when scalar updates are unsupported or cannot create a root field', () => {
      const deleteEditor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: '1A'
        }
      })
      const defaultReplaceEditor = new JsonMetadataPathEditor({
        ProcessingLevel: {
          Id: '1A'
        }
      })
      const missingDeleteEditor = new JsonMetadataPathEditor({
        CollectionProgress: 'COMPLETE'
      })
      const missingRootEditor = new JsonMetadataPathEditor({
        Platforms: []
      })

      expect(missingDeleteEditor.updateScalarNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1A'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })).toBe(false)

      expect(deleteEditor.updateScalarNode({
        action: 'delete',
        oldKeywordObject: {
          Value: '1A'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })).toBe(true)

      expect(deleteEditor.selectNodes('//ProcessingLevel/Id')).toEqual([])

      expect(defaultReplaceEditor.updateScalarNode({
        newKeywordObject: {
          Value: '1B'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })).toBe(true)

      expect(defaultReplaceEditor.getElementText(
        defaultReplaceEditor.selectNodes('//ProcessingLevel/Id')[0]
      )).toBe('1B')

      expect(missingRootEditor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Value: '1A'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })).toBe(false)

      expect(deleteEditor.updateScalarNode({
        action: 'noop',
        newKeywordObject: {
          Value: '1B'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })).toBe(false)

      expect(defaultReplaceEditor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {}
      }, {
        nodePath: '//MissingId',
        tagName: 'MissingId'
      })).toBe(false)

      const invalidPathEditor = new JsonMetadataPathEditor({
        ProcessingLevel: {}
      })
      const relativeCreateEditor = new JsonMetadataPathEditor({})
      const undefinedRootEditor = new JsonMetadataPathEditor(undefined)

      expect(invalidPathEditor.ensureEntryForSegments([], [-1])).toBeNull()
      expect(relativeCreateEditor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Value: '1A'
        }
      }, {
        nodePath: 'ProcessingLevel/Id'
      })).toBe(true)

      expect(relativeCreateEditor.document.ProcessingLevel.Id).toBe('1A')
      expect(undefinedRootEditor.updateScalarNode({
        action: 'replace',
        newKeywordObject: {
          Value: '1A'
        }
      }, {
        nodePath: '//ProcessingLevel/Id',
        tagName: 'Id'
      })).toBe(false)
    })
  })
})
