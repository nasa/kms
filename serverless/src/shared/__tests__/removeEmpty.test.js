import { describe, expect } from 'vitest'

import { removeEmpty } from '../removeEmpty'

describe('removeEmpty', () => {
  test('should remove empty values from a simple object', () => {
    const input = {
      name: 'John',
      age: null,
      city: '',
      isStudent: false
    }

    const expected = {
      name: 'John',
      isStudent: false
    }

    expect(removeEmpty(input)).toEqual(expected)
  })

  test('should remove empty values from nested objects', () => {
    const input = {
      name: 'John',
      address: {
        street: '',
        city: 'New York',
        country: undefined
      },
      contact: {
        email: 'john@example.com',
        phone: null
      }
    }

    const expected = {
      name: 'John',
      address: {
        city: 'New York'
      },
      contact: {
        email: 'john@example.com'
      }
    }

    expect(removeEmpty(input)).toEqual(expected)
  })

  test('should remove empty arrays', () => {
    const input = {
      name: 'John',
      hobbies: [],
      skills: ['JavaScript', 'React']
    }

    const expected = {
      name: 'John',
      skills: ['JavaScript', 'React']
    }

    expect(removeEmpty(input)).toEqual(expected)
  })

  test('should preserve boolean values', () => {
    const input = {
      name: 'John',
      isStudent: false,
      hasJob: true,
      hasCar: null
    }

    const expected = {
      name: 'John',
      isStudent: false,
      hasJob: true
    }

    expect(removeEmpty(input)).toEqual(expected)
  })

  test('should handle an empty object', () => {
    const input = {}
    const expected = {}

    expect(removeEmpty(input)).toEqual(expected)
  })

  test('should handle complex nested structures', () => {
    const input = {
      user: {
        name: 'John',
        details: {
          age: null,
          address: {
            street: '',
            city: 'New York',
            country: undefined
          }
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            sms: null
          }
        }
      },
      posts: [],
      comments: [
        {
          id: 1,
          text: 'Great post!',
          replies: []
        },
        {
          id: 2,
          text: '',
          replies: null
        }
      ]
    }

    const expected = {
      user: {
        name: 'John',
        details: {
          address: {
            city: 'New York'
          }
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        }
      },
      comments: [
        {
          id: 1,
          text: 'Great post!'
        },
        { id: 2 } // The empty object is not removed
      ]
    }

    expect(removeEmpty(input)).toEqual(expected)
  })
})
