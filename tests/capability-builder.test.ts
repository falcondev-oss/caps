/* eslint-disable unicorn/consistent-function-scoping */
import { describe, expect, expectTypeOf, test } from 'vitest'

import { defineCapabilitiesFor } from '../src/capability-builder'

describe('runtime', () => {
  test('basic', () => {
    const c = defineCapabilitiesFor({
      role: 'user',
    })

    const context = {
      project: c((actor) => () => {
        if (actor.role === 'admin') return ['delete']
        return ['read', 'write']
      }),
    }

    expect(context.project.can('read').check()).toBe(true)
    expect(() => context.project.can('delete').throw()).toThrowError()
  })

  test('actor', () => {
    const c = defineCapabilitiesFor({
      role: 'admin',
    })

    const _context = {
      project: c((actor) => {
        expect(actor).toEqual({ role: 'admin' })

        return ['read', 'write']
      }),
    }
  })

  test('args', () => {
    const c = defineCapabilitiesFor({
      role: 'admin',
    })

    const context = {
      project: c((actor) => (project: { name: string; id: string }) => {
        expect(actor).toEqual({ role: 'admin' })
        expect(project).toEqual({ name: 'Project', id: '123' })

        return ['read']
      }),
    }

    context.project.can('read', { id: '123', name: 'Project' }).check()
  })

  describe('complex', () => {
    function createTestContext(_actor: {
      isAdmin: boolean
      isSupervisor: boolean
      superviserOfUserIds?: string[]
    }) {
      const c = defineCapabilitiesFor(_actor)

      return {
        project: c(
          (actor) =>
            function* () {
              if (actor.isAdmin) yield ['write']

              return ['read']
            },
        ),
        user: c(
          (actor) =>
            function* () {
              if (actor.isAdmin) yield ['delete']
              if (actor.isSupervisor || actor.isAdmin) yield ['write']

              return ['read']
            },
        ),
        motd: c(['read']),
        task: c(
          (actor) =>
            function* (user: { id: string }) {
              if (actor.isAdmin) yield ['write']

              if (actor.isSupervisor && actor.superviserOfUserIds?.includes(user.id))
                yield ['write']

              return ['read']
            },
        ),
      }
    }

    test('admin', () => {
      const adminContext = createTestContext({ isAdmin: true, isSupervisor: false })
      expect(adminContext.motd.can('read').check()).toBe(true)
      expect(adminContext.project.can('write').check()).toBe(true)
      expect(adminContext.project.can('read').check()).toBe(true)
      expect(adminContext.user.can('delete').check()).toBe(true)
      expect(adminContext.user.can('write').check()).toBe(true)
      expect(adminContext.user.can('read').check()).toBe(true)

      expect(adminContext.task.can('write', { id: 'user1' }).check()).toBe(true)
      expect(adminContext.task.can('write', { id: 'user2' }).check()).toBe(true)

      expect(adminContext.task.can('read', { id: 'user1' }).check()).toBe(true)
      expect(adminContext.task.can('read', { id: 'user2' }).check()).toBe(true)
    })

    test('supervisor', () => {
      const supervisorContext = createTestContext({
        isAdmin: false,
        isSupervisor: true,
        superviserOfUserIds: ['user1', 'user3'],
      })
      expect(supervisorContext.motd.can('read').check()).toBe(true)
      expect(supervisorContext.project.can('write').check()).toBe(false)
      expect(supervisorContext.project.can('read').check()).toBe(true)
      expect(supervisorContext.user.can('delete').check()).toBe(false)
      expect(supervisorContext.user.can('write').check()).toBe(true)
      expect(supervisorContext.user.can('read').check()).toBe(true)

      expect(supervisorContext.task.can('write', { id: 'user1' }).check()).toBe(true)
      expect(supervisorContext.task.can('write', { id: 'user2' }).check()).toBe(false)
      expect(supervisorContext.task.can('write', { id: 'user3' }).check()).toBe(true)

      expect(supervisorContext.task.can('read', { id: 'user1' }).check()).toBe(true)
      expect(supervisorContext.task.can('read', { id: 'user2' }).check()).toBe(true)
      expect(supervisorContext.task.can('read', { id: 'user3' }).check()).toBe(true)
    })

    test('user', () => {
      const userContext = createTestContext({ isAdmin: false, isSupervisor: false })
      expect(userContext.motd.can('read').check()).toBe(true)

      expect(userContext.project.can('write').check()).toBe(false)
      expect(userContext.project.can('read').check()).toBe(true)
      expect(userContext.user.can('delete').check()).toBe(false)
      expect(userContext.user.can('write').check()).toBe(false)
      expect(userContext.user.can('read').check()).toBe(true)

      expect(userContext.task.can('write', { id: 'user1' }).check()).toBe(false)
      expect(userContext.task.can('write', { id: 'user2' }).check()).toBe(false)
      expect(userContext.task.can('write', { id: 'user3' }).check()).toBe(false)

      expect(userContext.task.can('read', { id: 'user1' }).check()).toBe(true)
      expect(userContext.task.can('read', { id: 'user2' }).check()).toBe(true)
      expect(userContext.task.can('read', { id: 'user3' }).check()).toBe(true)
    })
  })
})

describe('types', () => {
  test('capability names', () => {
    const c = defineCapabilitiesFor({})

    const context = {
      project: c(['read', 'write']),
      task: c(() => ['read', 'write']),
      motd: c(() => () => ['read', 'write']),
      user: c(
        () =>
          function* () {
            yield ['delete']
            return ['read', 'write']
          },
      ),
    }

    expectTypeOf(context.project.can).parameter(0).toEqualTypeOf<'read' | 'write'>()
    expectTypeOf(context.task.can).parameter(0).toEqualTypeOf<'read' | 'write'>()
    expectTypeOf(context.motd.can).parameter(0).toEqualTypeOf<'read' | 'write'>()
    expectTypeOf(context.user.can).parameter(0).toEqualTypeOf<'read' | 'write' | 'delete'>()
  })

  test('args', () => {
    const c = defineCapabilitiesFor({})

    const context = {
      project: c(() => (_project: { name: string; id: string }) => ['read']),
    }

    expectTypeOf(context.project.can).parameter(1).toEqualTypeOf<{
      name: string
      id: string
    }>()
  })
})
