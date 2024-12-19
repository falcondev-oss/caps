import type { Exact } from 'type-fest'

export function arg<T extends object>() {
  return {} as T
}

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

export interface ContextOptions {
  createError?: (args: { capability: string }) => unknown
}

export function createActor<Actor>() {
  return {
    build<D>(builder: (cap: ReturnType<typeof createCapability<Actor>>) => D) {
      return (actor: Actor, opts?: ContextOptions) => {
        return builder(createCapability(actor, opts))
      }
    },
  }
}

function createCapability<Actor>(actor: Actor, opts?: ContextOptions) {
  function getDefine<Subject = undefined>() {
    return <
      const Capability extends string,
      // eslint-disable-next-line ts/no-empty-object-type
      Args extends Exact<Partial<Record<Capability, any>>, Args> | {} = {},
      ArgsType = {
        [K in keyof Args]: Args[K] extends (...args: any[]) => any ? ReturnType<Args[K]> : Args[K]
      },
    >(
      resolver: (ctx: {
        actor: Actor
        subject: Subject
        args: Partial<ArgsType>
      }) => Generator<Capability[], Capability[]>,
      args?: Args,
    ) =>
      createQuery<Actor, Subject, Capability, ArgsType>({
        actor,
        resolver,
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

function createQuery<Actor, Subject, Capabilities extends string, Args>({
  actor,
  resolver,
  opts,
}: {
  actor: Actor
  opts?: ContextOptions
  resolver: (ctx: {
    actor: Actor
    subject: Subject
    args: Partial<Args>
  }) => Generator<Capabilities[], Capabilities[]>
}) {
  type HasArgs<Capability> = Capability extends keyof Args
    ? Args[Capability] extends undefined
      ? []
      : [args: Args[Capability]]
    : []

  function list({ subject, args }: { subject: Subject; args: Partial<Args> }) {
    const generator = resolver({
      actor,
      subject,
      args,
    })

    return collectGenerator(generator)
  }

  function getCan(subject: Subject) {
    return <Capability extends Capabilities>(
      capability: Capability,
      ...args: HasArgs<Capability>
    ) => {
      const getCapabilities = () => list({ subject, args: args[0] ?? {} })

      return {
        throw: () => {
          const actorCaps = list({ subject, args: args[0]! })
          if (actorCaps.includes(capability)) return

          throw (
            opts?.createError?.({ capability }) ?? new Error(`Missing capability: '${capability}'`)
          )
        },
        check: () => getCapabilities().includes(capability),
      }
    }
  }

  const query = {
    subject: (subject: Subject) => ({
      can: getCan(subject),
      list(args: Partial<Args>) {
        return list({ subject, args })
      },
    }),
    subjects: (subjects: Subject[]) => ({
      canSome: <Capability extends Capabilities>(
        capability: Capability,
        ...args: HasArgs<Capability>
      ) => {
        return {
          check: () => subjects.some((subject) => getCan(subject)(capability, ...args).check()),
          throw: () => subjects.some((subject) => getCan(subject)(capability, ...args).throw()),
        }
      },
      canEvery: <Capability extends Capabilities>(
        capability: Capability,
        ...args: HasArgs<Capability>
      ) => {
        return {
          check: () => subjects.every((subject) => getCan(subject)(capability, ...args).check()),
          throw: () => {
            if (subjects.every((subject) => getCan(subject)(capability, ...args).check())) return

            throw (
              opts?.createError?.({ capability }) ??
              new Error(`Missing capability: '${capability}'`)
            )
          },
        }
      },
    }),
    can: getCan(undefined as Subject),
    list(args: Partial<Args>) {
      return list({ subject: undefined as Subject, args })
    },
  }

  return query as Omit<typeof query, Subject extends undefined ? 'subject' | 'subjects' : 'can'>
}
