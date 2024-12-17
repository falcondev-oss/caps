import type {
  CapabilityResolver,
  CapabilityResolverContext,
  ObjectToDiscriminatedUnion,
  inferCapabilitiesFromResolver,
  inferResolverArgs,
  inferResolverCapabilities,
  inferResolverContext,
} from './types'
import type { Exact, Simplify } from 'type-fest'

export interface CreateBuildContextOptions {
  createError?: (message: string) => Error
}

export function arg<T extends object>() {
  return {} as T
}

export function createBuildContext<Actor>(actor: Actor, opts?: CreateBuildContextOptions) {
  function getDefine<Subject = undefined>() {
    return <
      const Capability extends string,
      Args extends Exact<Partial<Record<Capability, any>>, Args>,
      ArgsType = {
        [K in keyof Args]: Args[K] extends (...args: any[]) => any ? ReturnType<Args[K]> : Args[K]
      },
    >(
      resolver: (ctx: {
        actor: Actor
        subject: Subject
        args: ObjectToDiscriminatedUnion<ArgsType>
      }) => Generator<Capability[], Capability[]>,
      args: Args,
    ) =>
      createCapabilityQueryBuilder<Subject, Capability, ArgsType>({
        resolver,
        actor,
        opts,
      })
  }

  return {
    subject: <Subject>() => ({
      define: getDefine<Subject>(),
    }),
    define: getDefine(),
  }
}

function createCapabilityBuilder<Actor>() {
  return {
    define<D>(builder: (c: ReturnType<typeof createBuildContext<Actor>>) => D) {
      return (actor: Actor, opts?: CreateBuildContextOptions) => {
        return builder(createBuildContext(actor, opts))
      }
    },
  }
}

function createCapabilityQueryBuilder<Subject, Capabilities extends string, Args>({
  actor,
  resolver,
  opts,
}: {
  actor: any
  opts?: CreateBuildContextOptions
  resolver: (ctx: {
    actor: any
    subject: any
    args: ObjectToDiscriminatedUnion<Args>
  }) => Generator<Capabilities[], Capabilities[]>
}) {
  type CanArgs<Capability> = Capability extends keyof Args
    ? Args[Capability] extends undefined
      ? []
      : [args: Args[Capability]]
    : []

  function getCan(subject: Subject | undefined) {
    return <Capability extends Capabilities>(
      capability: Capability,
      ...args: CanArgs<Capability>
    ) => {
      function getCapabilities() {
        const generator = resolver({
          // eslint-disable-next-line ts/no-unsafe-assignment
          actor,
          subject,
          // eslint-disable-next-line ts/no-unsafe-assignment
          args: {
            capability,
            ...(args[0] as any),
          },
        })

        return collectGenerator(generator)
      }

      return {
        throw: () => {
          const actorCaps = getCapabilities()
          if (actorCaps.includes(capability)) return

          const message = `User does not have capability ${capability}`
          throw opts?.createError?.(message) ?? new Error(message)
        },
        check: () => getCapabilities().includes(capability),
      }
    }
  }

  const builder = {
    subject: (subject: Subject) => ({
      can: getCan(subject),
    }),
    subjects: (subjects: Subject[]) => ({
      canSome: <Capability extends Capabilities>(
        capability: Capability,
        ...args: CanArgs<Capability>
      ) => {
        return {
          check: () => subjects.some((subject) => getCan(subject)(capability, ...args).check()),
          throw: () => subjects.some((subject) => getCan(subject)(capability, ...args).throw()),
        }
      },
      canEvery: <Capability extends Capabilities>(
        capability: Capability,
        ...args: CanArgs<Capability>
      ) => {
        return {
          check: () => subjects.every((subject) => getCan(subject)(capability, ...args).check()),
          throw: () => {
            if (subjects.every((subject) => getCan(subject)(capability, ...args).check())) return

            const message = 'User does not have capability'
            throw opts?.createError?.(message) ?? new Error(message)
          },
        }
      },
    }),
    can: getCan(undefined),
  }

  return builder as Omit<typeof builder, Subject extends undefined ? 'subject' : 'can'>
}

const useCaps = createCapabilityBuilder<{
  permissions: string[]
}>().define((c) => {
  return {
    absenceRequest: {
      a: c
        .subject<{
          absenceRequestId: string
        }>()
        .define(
          function* ({ actor, args, subject }) {
            yield ['update']
            return ['read', 'write']
          },
          {
            update: arg<{
              wow: string
            }>,
          },
        ),
      b: c.define(
        function* ({ actor, args, subject }) {
          yield ['read']
          return ['write']
        },
        {
          read: arg<{ hey: string }>,
        },
      ),
    },
  }
})

const caps = useCaps({ permissions: ['yes'] })

caps.absenceRequest.a.subject({ absenceRequestId: '123' }).can('read')
caps.absenceRequest.a.subjects([{ absenceRequestId: '123' }]).canSome('update', { wow: 'hey' })

caps.absenceRequest.b.can('read', { hey: 'bob' })

function collectGenerator<T>(generator: Generator<T, T>) {
  const items = []
  let next = generator.next()
  do {
    items.push(next.value)
    next = generator.next()
  } while (!next.done)
  items.push(next.value)

  return items.filter(Boolean).flat()
}
