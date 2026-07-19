import { test, expect } from 'vitest'
import { parseRows, rowsFromCells, findCells, adjacent, samePos, inBounds } from '../../src/engine/board'

const rows = ['S.g', 'ryE', '.M.']

test('parseRows maps chars to kinds', () => {
  const cells = parseRows(rows)
  expect(cells[0]![0]).toBe('start')
  expect(cells[0]![1]).toBe('empty')
  expect(cells[0]![2]).toBe('gray')
  expect(cells[1]![0]).toBe('red')
  expect(cells[1]![1]).toBe('yellow')
  expect(cells[1]![2]).toBe('exit')
  expect(cells[2]![1]).toBe('mid')
})

test('parseRows rejects unknown chars and ragged rows', () => {
  expect(() => parseRows(['SX'])).toThrow()
  expect(() => parseRows(['S.', 'E'])).toThrow()
})

test('rowsFromCells round-trips', () => {
  expect(rowsFromCells(parseRows(rows))).toEqual(rows)
})

test('findCells locates all of a kind', () => {
  expect(findCells(parseRows(rows), 'start')).toEqual([{ r: 0, c: 0 }])
  expect(findCells(parseRows(rows), 'yellow')).toEqual([{ r: 1, c: 1 }])
})

test('adjacency is orthogonal only', () => {
  expect(adjacent({ r: 0, c: 0 }, { r: 0, c: 1 })).toBe(true)
  expect(adjacent({ r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false)
  expect(adjacent({ r: 0, c: 0 }, { r: 0, c: 0 })).toBe(false)
})

test('samePos and inBounds', () => {
  expect(samePos({ r: 1, c: 2 }, { r: 1, c: 2 })).toBe(true)
  expect(inBounds(3, { r: 2, c: 2 })).toBe(true)
  expect(inBounds(3, { r: 3, c: 0 })).toBe(false)
  expect(inBounds(3, { r: -1, c: 0 })).toBe(false)
})
