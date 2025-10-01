import type { Arrayable, TaggedUnion } from 'type-fest'

export { type ContextOptions, createActor, MissingCapabilityError } from './capabilties'

export function arg<T extends object>() {
  return {} as T
}

export type Modes<T extends Record<string, Record<string, unknown>>> = TaggedUnion<'__mode', T>

function modeFn<const M extends string, T extends Record<string, unknown>>(
  mode: M,
  obj: T,
): { __mode: M } & T
function modeFn<const M extends string, T extends Record<string, unknown>[]>(
  mode: M,
  list: T,
): { [K in keyof T & number]: { __mode: M } & T[K] }[keyof T & number][]
function modeFn<const M extends string, T extends Arrayable<Record<string, unknown>>>(
  mode: M,
  data: T,
) {
  if (Array.isArray(data)) {
    return data.map((o) => ({ __mode: mode, ...o }))
  }
  return { __mode: mode, ...data }
}

export { modeFn as mode }
