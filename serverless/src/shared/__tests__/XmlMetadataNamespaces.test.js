import { DOMParser } from '@xmldom/xmldom'
import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'
import { XmlMetadataPathEditor } from '../XmlMetadataPathEditor'

const namespace = 'http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/'
const formats = ['unqualified', 'default namespace', 'prefixed namespace']
const documentFor = (format) => {
  const prefix = format === 'prefixed namespace' ? 'dif:' : ''
  const declaration = format === 'unqualified'
    ? ''
    : `xmlns${prefix ? ':dif' : ''}="${namespace}"`

  return `<${prefix}DIF ${declaration}>
    <${prefix}Entry_Title>Unrelated collection title</${prefix}Entry_Title>
    <${prefix}Project id="target">
      <${prefix}Short_Name>OLD</${prefix}Short_Name>
    </${prefix}Project>
    <${prefix}Project id="untouched">
      <${prefix}Short_Name>OTHER</${prefix}Short_Name>
    </${prefix}Project>
  </${prefix}DIF>`
}

const elements = (document, localName) => Array.from(document.getElementsByTagName('*'))
  .filter((element) => element.localName === localName)

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml')

describe('namespace-aware metadata field edits', () => {
  test.each(formats)('reads and updates an existing field in %s', (format) => {
    const editor = new XmlMetadataPathEditor(documentFor(format))
    const project = editor.selectNodes('//DIF/Project')[0]
    const shortName = elements(editor.document, 'Short_Name')[0]

    expect(editor.getNestedText(project, 'Short_Name')).toBe('OLD')
    editor.setNestedText(project, 'Short_Name', 'NEW')
    expect(editor.getDirectChildElement(project, 'Short_Name')).toBe(shortName)
    expect(shortName.textContent).toBe('NEW')
    expect(elements(editor.document, 'Short_Name')).toHaveLength(2)
    expect(elements(editor.document, 'Short_Name')[1].textContent).toBe('OTHER')
  })

  test.each(formats)('creates a field in the parent namespace for %s', (format) => {
    const editor = new XmlMetadataPathEditor(documentFor(format))
    const project = editor.selectNodes('//DIF/Project')[0]
    const added = editor.ensureDirectChildElement(project, 'Long_Name')

    expect(added.namespaceURI || null).toBe(project.namespaceURI || null)
    expect(added.prefix || null).toBe(project.prefix || null)
    expect(editor.ensureDirectChildElement(project, 'Long_Name')).toBe(added)
    editor.setNestedText(project, 'Long_Name', 'Description')
    const reparsed = parse(editor.serialize())
    const reparsedLongName = elements(reparsed, 'Long_Name')[0]

    expect(reparsedLongName.namespaceURI || null).toBe(project.namespaceURI || null)
    expect(reparsedLongName.textContent).toBe('Description')
  })

  test.each(formats)('applies real DIF10 corrections in %s', async (format) => {
    const metadataPayload = documentFor(format)
    const result = await applyDif10MetadataCorrections({
      metadataPayload,
      corrections: [{
        scheme: 'projects',
        action: 'replace',
        oldKeywordObject: { ShortName: 'OLD' },
        newKeywordObject: { ShortName: 'NEW' },
        newLongName: 'New description'
      }]
    })
    const document = parse(result.correctedMetadata)
    const projects = elements(document, 'Project')

    expect(result.correctionCount).toBe(1)
    expect(elements(document, 'Short_Name').map((node) => node.textContent))
      .toEqual(['NEW', 'OTHER'])

    expect(projects.map((node) => node.getAttribute('id'))).toEqual(['target', 'untouched'])
    expect(elements(document, 'Entry_Title')[0].textContent).toBe('Unrelated collection title')
    const longName = elements(document, 'Long_Name')[0]
    expect(longName.textContent).toBe('New description')
    expect(longName.namespaceURI || null).toBe(projects[0].namespaceURI || null)
    expect(metadataPayload).toBe(documentFor(format))
  })

  test.each(formats)('deletes only the matched DIF10 project in %s', async (format) => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: documentFor(format),
      corrections: [{
        scheme: 'projects',
        action: 'delete',
        oldKeywordObject: { ShortName: 'OLD' }
      }]
    })
    const document = parse(result.correctedMetadata)

    expect(result.correctionCount).toBe(1)
    expect(elements(document, 'Project')).toHaveLength(1)
    expect(elements(document, 'Short_Name')[0].textContent).toBe('OTHER')
    expect(elements(document, 'Entry_Title')[0].textContent).toBe('Unrelated collection title')
  })

  test('does not overwrite an extension field with the same local name', () => {
    const editor = new XmlMetadataPathEditor(`
      <DIF xmlns="${namespace}" xmlns:extension="urn:example:extension">
        <Project>
          <extension:Short_Name>Extension value</extension:Short_Name>
          <Short_Name>OLD</Short_Name>
        </Project>
      </DIF>`)
    const project = editor.selectNodes('//DIF/Project')[0]

    expect(editor.getNestedText(project, 'Short_Name')).toBe('OLD')
    editor.setNestedText(project, 'Short_Name', 'NEW')
    expect(elements(editor.document, 'Short_Name').map((node) => node.textContent))
      .toEqual(['Extension value', 'NEW'])
  })

  test('accepts another prefix bound to the same namespace', () => {
    const editor = new XmlMetadataPathEditor(`
      <dif:DIF xmlns:dif="${namespace}" xmlns:alias="${namespace}">
        <dif:Project><alias:Short_Name>OLD</alias:Short_Name></dif:Project>
      </dif:DIF>`)
    const project = editor.selectNodes('//DIF/Project')[0]

    expect(editor.getNestedText(project, 'Short_Name')).toBe('OLD')
    editor.setNestedText(project, 'Short_Name', 'NEW')
    expect(elements(editor.document, 'Short_Name')).toHaveLength(1)
    expect(elements(editor.document, 'Short_Name')[0].nodeName).toBe('alias:Short_Name')
    expect(elements(editor.document, 'Short_Name')[0].textContent).toBe('NEW')
  })

  test('retains exact qualified-name lookups', () => {
    const editor = new XmlMetadataPathEditor(documentFor('prefixed namespace'))
    const project = editor.selectNodes('//DIF/Project')[0]

    expect(editor.getDirectChildElement(project, 'dif:Short_Name').textContent).toBe('OLD')
    expect(editor.getDirectChildElement(project, 'other:Short_Name')).toBeNull()
  })
})
