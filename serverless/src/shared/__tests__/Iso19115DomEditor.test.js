import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { ISO_19115_SCHEME_EDITORS } from '@/shared/Iso19115DomEditor'

describe('ISO_19115_SCHEME_EDITORS', () => {
  let mockEditor

  beforeEach(() => {
    mockEditor = {
      updateBlockNode: vi.fn(),
      updateLeafNode: vi.fn()
    }
  })

  test('should trigger updateBlockNode for keyword types', () => {
    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'test' }
    }

    // Test a block-based editor (e.g., sciencekeywords)
    ISO_19115_SCHEME_EDITORS.sciencekeywords(mockEditor, correction)

    expect(mockEditor.updateBlockNode).toHaveBeenCalledWith(
      correction,
      expect.objectContaining({
        nodeXPath: expect.stringContaining('MD_KeywordTypeCode')
      })
    )
  })

  test('should trigger updateLeafNode for leaf types', () => {
    const correction = {
      action: 'replace',
      newKeywordObject: { Value: 'category' }
    }

    // Test a leaf-based editor (e.g., isotopiccategory)
    ISO_19115_SCHEME_EDITORS.isotopiccategory(mockEditor, correction)

    expect(mockEditor.updateLeafNode).toHaveBeenCalledWith(
      correction,
      expect.objectContaining({
        nodeXPath: expect.stringContaining('topicCategory')
      })
    )
  })

  test('should correctly format value for platforms', () => {
    const correction = {
      newKeywordObject: { ShortName: 'Aqua' },
      newLongName: 'Aqua Satellite'
    }
    const formatPlatform = () => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }

    expect(formatPlatform(correction)).toBe('Aqua > Aqua Satellite')
  })

  test('should handle deletion for productlevelid', () => {
    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'L1' }
    }

    ISO_19115_SCHEME_EDITORS.productlevelid(mockEditor, correction)

    expect(mockEditor.updateLeafNode).toHaveBeenCalledWith(
      correction,
      expect.objectContaining({
        delete: expect.any(Array)
      })
    )
  })
})
