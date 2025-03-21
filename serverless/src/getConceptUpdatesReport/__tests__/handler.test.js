import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createChangeNoteItem } from '@/shared/createChangeNoteItem'
import { getConceptChangeNotes } from '@/shared/getConceptChangeNotes'
import { getApplicationConfig } from '@/shared/getConfig'

import { createCsvReport, getConceptUpdatesReport } from '../handler'

// Mock the imported modules
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getConceptChangeNotes')
vi.mock('@/shared/createChangeNoteItem')

describe('getConceptUpdatesReport', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: { 'Content-Type': 'application/json' } })
  })

  test('should return 400 if mandatory parameters are missing', async () => {
    const event = { queryStringParameters: {} }
    const response = await getConceptUpdatesReport(event)
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error).toContain('Missing mandatory parameter(s)')
  })

  test('should handle missing queryStringParameters', async () => {
    const event = {} // Event without queryStringParameters
    const response = await getConceptUpdatesReport(event)
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error).toContain('Missing mandatory parameter(s)')
  })

  test('should return 400 if date format is invalid', async () => {
    const event = {
      queryStringParameters: {
        version: '1.0',
        startDate: '2023-01-01',
        endDate: 'invalid-date'
      }
    }
    const response = await getConceptUpdatesReport(event)
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error).toContain('Invalid date format')
  })

  test('should return 200 with CSV data for valid input', async () => {
    const event = {
      queryStringParameters: {
        version: '1.0',
        startDate: '2023-01-01',
        endDate: '2023-06-30',
        scheme: 'MyScheme',
        userId: 'user123'
      }
    }

    getConceptChangeNotes.mockResolvedValue([
      { changeNote: { value: 'Sample change note' } }
    ])

    createChangeNoteItem.mockReturnValue({
      date: '2023-06-01',
      userId: 'user123',
      entity: 'Concept',
      operation: 'Update',
      field: 'Label',
      oldValue: 'Old',
      newValue: 'New'
    })

    const response = await getConceptUpdatesReport(event)
    expect(response.statusCode).toBe(200)
    expect(response.headers['Content-Type']).toBe('text/csv')
    expect(response.headers['Content-Disposition']).toContain('attachment; filename=KeywordUpdateReport-2023-01-01-2023-06-30.csv')
    expect(response.body).toContain('Keyword Change Report')
    expect(response.body).toContain('"Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"')
    expect(response.body).toContain('"2023-06-01","user123","Concept","Update","","Label","","Old","New"')
  })
})

describe('createCsvReport', () => {
  test('should create a CSV report from processed change notes', () => {
    const notes = [
      {
        date: '2023-06-01',
        userId: 'user1',
        entity: 'Concept',
        operation: 'Update',
        field: 'Label',
        oldValue: 'Old',
        newValue: 'New'
      },
      {
        date: '2023-06-02',
        userId: 'user2',
        entity: 'Concept',
        operation: 'Create',
        field: 'Definition',
        oldValue: '',
        newValue: 'New definition'
      }
    ]
    const csv = createCsvReport(notes, null, 'Change Report')
    expect(csv).toContain('Change Report')
    expect(csv).toContain('"Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"')
    expect(csv).toContain('"2023-06-02","user2","Concept","Create","","Definition","","","New definition"')
    expect(csv).toContain('"2023-06-01","user1","Concept","Update","","Label","","Old","New"')
  })

  test('should filter notes by userId when provided', () => {
    const notes = [
      {
        date: '2023-06-01',
        userId: 'user1',
        entity: 'Concept',
        operation: 'Update',
        field: 'Label',
        oldValue: 'Old',
        newValue: 'New'
      },
      {
        date: '2023-06-02',
        userId: 'user2',
        entity: 'Concept',
        operation: 'Create',
        field: 'Definition',
        oldValue: '',
        newValue: 'New definition'
      }
    ]
    const csv = createCsvReport(notes, 'user1', 'Filtered Report')
    expect(csv).toContain('Filtered Report')
    expect(csv).toContain('"2023-06-01","user1","Concept","Update","","Label","","Old","New"')
    expect(csv).not.toContain('user2')
  })

  test('should handle empty input', () => {
    const csv = createCsvReport([], null, 'Empty Report')
    expect(csv).toContain('Empty Report')
    expect(csv).toContain('"Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"')
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2) // Title and headers only, no data rows
    expect(lines[0]).toBe('Empty Report')
    expect(lines[1]).toBe('"Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"')
  })

  test('should properly escape and quote values', () => {
    const notes = [
      {
        date: '2023-06-01',
        userId: 'user,1',
        entity: 'Concept',
        operation: 'Update',
        field: 'Label',
        oldValue: 'Old "quoted" value',
        newValue: 'New,value'
      }
    ]
    const csv = createCsvReport(notes, null, 'Escaped Report')
    expect(csv).toContain('"user,1"') // Comma in userId should be quoted
    expect(csv).toContain('"Old ""quoted"" value"') // Double quotes should be escaped
    expect(csv).toContain('"New,value"') // Comma in newValue should be quoted
  })

  test('should sort notes by date, newest first', () => {
    const notes = [
      {
        date: '2023-06-01',
        userId: 'user1',
        entity: 'Concept',
        operation: 'Update',
        field: 'Label',
        oldValue: 'Old',
        newValue: 'New'
      },
      {
        date: '2023-06-03',
        userId: 'user2',
        entity: 'Concept',
        operation: 'Create',
        field: 'Definition',
        oldValue: '',
        newValue: 'New definition'
      },
      {
        date: '2023-06-02',
        userId: 'user3',
        entity: 'Concept',
        operation: 'Delete',
        field: '',
        oldValue: '',
        newValue: ''
      }
    ]
    const csv = createCsvReport(notes, null, 'Sorted Report')
    const lines = csv.split('\n')
    expect(lines[2]).toContain('"2023-06-03"') // Newest date should be first
    expect(lines[3]).toContain('"2023-06-02"')
    expect(lines[4]).toContain('"2023-06-01"') // Oldest date should be last
  })

  test('should handle undefined or null values', () => {
    const notes = [
      {
        date: '2023-06-01',
        userId: null,
        entity: undefined,
        operation: 'Update',
        field: 'Label',
        oldValue: '',
        newValue: 'New'
      }
    ]
    const csv = createCsvReport(notes, null, 'Null Value Report')
    expect(csv).toContain('"2023-06-01","","","Update","","Label","","","New"')
  })

  test('should handle custom headers and hit the default case', () => {
    const notes = [
      {
        date: '2023-06-01',
        userId: 'user1',
        entity: 'Concept',
        operation: 'Update',
        field: 'Label',
        oldValue: 'Old',
        newValue: 'New',
        customField: 'Custom Value'
      }
    ]

    const customHeaders = ['Date', 'User Id', 'Entity', 'Operation', 'Field', 'Old Value', 'New Value', 'Custom Field']

    const csv = createCsvReport(notes, null, 'Custom Header Report', customHeaders)
    const lines = csv.split('\n')

    expect(lines[0]).toBe('Custom Header Report')
    expect(lines[1]).toBe('"Date","User Id","Entity","Operation","Field","Old Value","New Value","Custom Field"')
    expect(lines[2]).toBe('"2023-06-01","user1","Concept","Update","Label","Old","New",""')

    // Ensure that the custom field is empty (undefined)
    const values = lines[2].split(',')
    expect(values[values.length - 1]).toBe('""')
  })
})
