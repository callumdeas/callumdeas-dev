import type { LandmarkId } from './planet'

export type Selection = { kind: 'landmark'; id: LandmarkId } | { kind: 'avatar' } | null

export const sameSelection = (a: Selection, b: Selection) => {
  if (a === null || b === null) return a === b
  if (a.kind === 'avatar' || b.kind === 'avatar') return a.kind === b.kind
  return a.id === b.id
}
