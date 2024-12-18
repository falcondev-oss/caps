import { describe, expect, expectTypeOf, test } from 'vitest'

import { arg, createActor } from '../src/'

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
    const caps = useActor({ userId: '1', role: 'user' })

    const selfUser = caps.user.subject({ userId: '1', role: 'user' })
    const otherUser = caps.user.subject({ userId: '2', role: 'user' })

    expect(selfUser.can('read').check()).toBe(true)
    expect(selfUser.can('update').check()).toBe(true)
    expect(selfUser.can('delete', { delayed: false }).check()).toBe(true)

    expect(otherUser.list({})).toEqual(['read'])
  })

  test('admin', () => {
    const caps = useActor({ userId: '1', role: 'admin' })

    const selfUser = caps.user.subject({ userId: '1', role: 'user' })
    const otherUser = caps.user.subject({ userId: '2', role: 'user' })

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
  })
})
