import {
  describe,
  expect,
  test
} from 'vitest'

import { parseCsv } from '../parseCsv'

describe('parseCsv', () => {
  test('parses csv content while skipping empty lines and tolerating uneven columns', () => {
    expect(parseCsv([
      '"Header1","Header2"',
      '',
      '"A","B"',
      '"C"'
    ].join('\n'))).toEqual([
      ['Header1', 'Header2'],
      ['A', 'B'],
      ['C']
    ])
  })

  test('tolerates relaxed quotes used by existing keyword csv exports', () => {
    expect(parseCsv('"Header"\n"value with "quotes""')).toEqual([
      ['Header'],
      ['"value with "quotes""']
    ])
  })
})
