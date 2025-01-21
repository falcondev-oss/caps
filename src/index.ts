import type { TaggedUnion } from 'type-fest'

export { type ContextOptions, createActor } from './capabilties'

export function arg<T extends object>() {
  return {} as T
}

export type Modes<T extends Record<string, Record<string, unknown>>> = TaggedUnion<'__mode', T>

export function mode<const K extends string, T extends Record<string, unknown>>(
  key: K,
  obj: T,
): { __mode: K } & T {
  return { __mode: key, ...obj }
}
