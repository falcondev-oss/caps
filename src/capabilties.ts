import type { Exact, IfEmptyObject } from 'type-fest'

import * as R from 'remeda'

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

export function createActor<Actor extends object>() {
  return {
    build<D>(builder: (cap: ReturnType<typeof createCapability<Actor>>) => D) {
      return (actor: Actor, opts?: ContextOptions) => {
        return builder(createCapability(actor, opts))
      }
    },
  }
}

const filterInputSymbol = Symbol('filterInput')

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

  function list({ subject, args = {} }: { subject: Subject; args?: Partial<Args> }) {
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
      list(args: IfEmptyObject<Args, void, Partial<Args>>) {
        return list({
          subject,
          args: args as Partial<Args> | undefined,
        })
      },
    }),
    subjects: <const S>(
      subjects: S[],
      ...args: S extends Subject ? [] : [mapper: (s: S) => Subject]
    ) => {
      const mapper = args[0]
      const mappedSubjects = mapper ? subjects.map(mapper) : (subjects as unknown as Subject[])

      return {
        canSome: <Capability extends Capabilities>(
          capability: Capability,
          ...args: HasArgs<Capability>
        ) => {
          return {
            check: () =>
              mappedSubjects.some((subject) => getCan(subject)(capability, ...args).check()),
            throw: () =>
              mappedSubjects.some((subject) => getCan(subject)(capability, ...args).throw()),
          }
        },
        canEvery: <Capability extends Capabilities>(
          capability: Capability,
          ...args: HasArgs<Capability>
        ) => {
          return {
            check: () =>
              mappedSubjects.every((subject) => getCan(subject)(capability, ...args).check()),
            throw: () => {
              if (mappedSubjects.every((subject) => getCan(subject)(capability, ...args).check()))
                return

              throw (
                opts?.createError?.({ capability }) ??
                new Error(`Missing capability: '${capability}'`)
              )
            },
          }
        },
        filter: <const FilterCaps extends Capabilities>(
          capabilities: FilterCaps[],
          args: IfEmptyObject<Args, void, Partial<Args>>,
        ) => {
          return subjects
            .map((s) => ({
              ...(mapper ? mapper(s) : (s as unknown as Subject)),
              [filterInputSymbol]: s,
            }))
            .filter(
              (subject) =>
                R.intersection(
                  list({
                    subject,
                    args: args as Partial<Args> | undefined,
                  }),
                  capabilities,
                ).length === capabilities.length,
            )
            .map((s) => s[filterInputSymbol])
        },
      }
    },
    can: getCan(undefined as Subject),
    list(args: IfEmptyObject<Args, void, Partial<Args>>) {
      return list({
        subject: undefined as Subject,
        args: args as Partial<Args> | undefined,
      })
    },
  }

  return query as Omit<typeof query, Subject extends undefined ? 'subject' | 'subjects' : 'can'>
}
