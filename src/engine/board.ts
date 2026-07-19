import type { CellKind, Pos } from './types'

const CHAR_TO_KIND: Record<string, CellKind> = {
  '.': 'empty', S: 'start', E: 'exit', M: 'mid', g: 'gray', y: 'yellow', r: 'red',
}
const KIND_TO_CHAR: Record<CellKind, string> = {
  empty: '.', start: 'S', exit: 'E', mid: 'M', gray: 'g', yellow: 'y', red: 'r',
}

export function parseRows(rows: string[]): CellKind[][] {
  return rows.map((row) => {
    if (row.length !== rows[0]!.length) throw new Error('ragged rows')
    return [...row].map((ch) => {
      const kind = CHAR_TO_KIND[ch]
      if (!kind) throw new Error(`unknown cell char: ${ch}`)
      return kind
    })
  })
}

export function rowsFromCells(cells: CellKind[][]): string[] {
  return cells.map((row) => row.map((k) => KIND_TO_CHAR[k]).join(''))
}

export function findCells(cells: CellKind[][], kind: CellKind): Pos[] {
  const out: Pos[] = []
  cells.forEach((row, r) => row.forEach((k, c) => { if (k === kind) out.push({ r, c }) }))
  return out
}

export function samePos(a: Pos, b: Pos): boolean { return a.r === b.r && a.c === b.c }
export function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1
}
export function inBounds(size: number, p: Pos): boolean {
  return p.r >= 0 && p.r < size && p.c >= 0 && p.c < size
}
