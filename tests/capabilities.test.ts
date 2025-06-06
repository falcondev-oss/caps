import type { Modes } from '../src/'

import { range } from 'remeda'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { arg, createActor, MissingCapabilityError, mode } from '../src/'

test('minimal example', () => {
  let i = 0
  const useActor = createActor<{ a: 1 }>().build((cap) => ({
    // eslint-disable-next-line unused-imports/no-unused-vars
    a: cap.define(function* ({ actor, subject, args }) {
      // eslint-disable-next-line ts/no-empty-object-type
      expectTypeOf(args).toEqualTypeOf<{}>()

      if (i === 0) expect(args).toEqual({})
      if (i === 1) expect(args).toEqual({ not_defined: true })

      i++
      yield ['yield']
      return ['return']
    }),
  }))

  const caps = useActor({ a: 1 })

  expect(caps.a.can('yield').check()).toBe(true)
  // @ts-expect-error - don't allow args when no args are defined
  expect(caps.a.can('yield', { not_defined: true }).check()).toBe(true)

  expect(caps.a.list()).toEqual(['yield', 'return'])
})

test('modes', () => {
  const useActor = createActor().build((cap) => ({
    a: cap
      .subject<
        Modes<{
          a: { a: number }
          b: { b: number }
        }>
      >()
      .define(function* () {
        yield ['read']
        return []
      }),
  }))

  const caps = useActor({})

  const filtered = caps.a.subjects(range(1, 5), (i) => mode('b', { b: i })).filter(['read'])

  expectTypeOf(filtered).toMatchTypeOf<number[]>()
})

describe('user management demo', () => {
  type Role = 'user' | 'moderator' | 'admin'

  type User = {
    userId: string
    role: Role
    isBanned?: true
  }

  const useActor = createActor<User>().build((cap) => ({
    user: cap.subject<User>().define(
      function* ({ actor, subject, args }) {
        // banned users can't do anything
        if (actor.isBanned) return []

        // everyone can read users
        yield ['read']

        // users can update & archive themselves
        if (actor.userId === subject.userId) yield ['update', 'delete']

        // admins can do anything, but can only delete users with a delay
        if (actor.role === 'admin') {
          yield ['create', 'update', 'set_role']

          if (args.delete?.delayed) yield ['delete']
        }

        // moderators can only set_role of other users & moderators
        if (
          actor.role === 'moderator' &&
          (args.set_role?.role === 'user' || args.set_role?.role === 'moderator') &&
          subject.role !== 'admin'
        ) {
          yield ['set_role']
        }

        return []
      },
      {
        set_role: arg<{ role: Role }>(),
        delete: arg<{ delayed: boolean }>,
      },
    ),
  }))

  test('user', () => {
    const selfUserData = { userId: '1', role: 'user' } as const
    const otherUserData = { userId: '2', role: 'user' } as const

    const caps = useActor(selfUserData)

    const selfUser = caps.user.subject(selfUserData)
    const otherUser = caps.user.subject(otherUserData)

    expect(selfUser.can('read').check()).toBe(true)
    expect(selfUser.can('update').check()).toBe(true)
    expect(selfUser.can('delete', { delayed: false }).check()).toBe(true)

    expect(otherUser.list({})).toEqual(['read'])
    expect(() => otherUser.can('update').throw()).toThrow(MissingCapabilityError)
    expect(() => otherUser.can('update').throw()).toThrow("Missing capability: 'update'")

    expect(caps.user.subjects([selfUserData, otherUserData]).filter(['update'], {})).toEqual([
      selfUserData,
    ])
    expect(caps.user.subjects([selfUserData, otherUserData]).filter(['read'], {})).toEqual([
      selfUserData,
      otherUserData,
    ])
  })

  test('admin', () => {
    const selfUserData = { userId: '1', role: 'admin' } as const
    const otherUserData = { userId: '2', role: 'user' } as const

    const caps = useActor(selfUserData)

    const selfUser = caps.user.subject(selfUserData)
    const otherUser = caps.user.subject(otherUserData)

    expect(selfUser.can('create').check()).toBe(true)
    expect(selfUser.can('update').check()).toBe(true)
    expect(selfUser.can('set_role', { role: 'moderator' }).check()).toBe(true)
    expect(selfUser.can('delete', { delayed: true }).check()).toBe(true)

    expect(
      otherUser.list({
        delete: { delayed: true },
        set_role: { role: 'admin' },
      }),
    ).toEqual(['read', 'create', 'update', 'set_role', 'delete'])

    expect(
      caps.user
        .subjects([selfUserData, otherUserData])
        .filter(['delete'], { delete: { delayed: true } }),
    ).toEqual([selfUserData, otherUserData])
  })
})
