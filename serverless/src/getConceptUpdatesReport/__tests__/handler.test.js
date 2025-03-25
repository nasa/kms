import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createChangeNoteItem } from '@/shared/createChangeNoteItem'
import { getConceptChangeNoteTriples } from '@/shared/getConceptChangeNoteTriples'
import { getApplicationConfig } from '@/shared/getConfig'

import { createCsvReport, getConceptUpdatesReport } from '../handler'

// Mock the imported modules
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getConceptChangeNoteTriples')
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

    getConceptChangeNoteTriples.mockResolvedValue([
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
    const csv = createCsvReport({
      changeNotes: notes,
      userId: null,
      title: 'Change Report',
      startDate: '2023-06-01',
      endDate: '2023-06-02'
    })
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
    const csv = createCsvReport({
      changeNotes: notes,
      userId: 'user1',
      title: 'Filtered Report',
      startDate: '2023-06-01',
      endDate: '2023-06-02'
    })
    expect(csv).toContain('Filtered Report')
    expect(csv).toContain('"2023-06-01","user1","Concept","Update","","Label","","Old","New"')
    expect(csv).not.toContain('user2')
  })

  test('should handle empty input', () => {
    const csv = createCsvReport({
      changeNotes: [],
      userId: null,
      title: 'Empty Report',
      startDate: '2023-06-01',
      endDate: '2023-06-02'
    })
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
    const csv = createCsvReport({
      changeNotes: notes,
      userId: null,
      title: 'Escaped Report',
      startDate: '2023-06-01',
      endDate: '2023-06-01'
    })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Escaped Report')
    expect(lines[1]).toBe('"Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"')
    expect(lines[2]).toBe('"2023-06-01","user,1","Concept","Update","","Label","","Old ""quoted"" value","New,value"')
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
    const csv = createCsvReport({
      changeNotes: notes,
      userId: null,
      title: 'Sorted Report',
      startDate: '2023-06-01',
      endDate: '2023-06-03'
    })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Sorted Report')
    expect(lines[1]).toBe('"Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"')
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
        systemNote: null,
        field: 'Label',
        userNote: undefined,
        oldValue: '',
        newValue: 'New'
      }
    ]
    const csv = createCsvReport({
      changeNotes: notes,
      userId: null,
      title: 'Null Value Report',
      startDate: '2023-06-01',
      endDate: '2023-06-01'
    })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Null Value Report')
    expect(lines[1]).toBe('"Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"')
    expect(lines[2]).toBe('"2023-06-01","","","Update","","Label","","","New"')
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

    const csv = createCsvReport({
      changeNotes: notes,
      userId: null,
      title: 'Custom Header Report',
      customHeaders,
      startDate: '2023-06-01',
      endDate: '2023-06-01'
    })
    const lines = csv.split('\n')

    expect(lines[0]).toBe('Custom Header Report')
    expect(lines[1]).toBe('"Date","User Id","Entity","Operation","Field","Old Value","New Value","Custom Field"')
    expect(lines[2]).toBe('"2023-06-01","user1","Concept","Update","Label","Old","New",""')

    // Ensure that the custom field is empty (undefined)
    const values = lines[2].split(',')
    expect(values[values.length - 1]).toBe('""')
  })
})
