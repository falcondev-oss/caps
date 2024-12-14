/* eslint-disable no-shadow */
import type { CapabilityResolver, inferCapabilitiesFromResolver, inferResolverArgs } from './types'

export interface DefineCapabilitiesForOptions {
  createError?: (message: string) => void
}

export function defineCapabilitiesFor<Actor>(actor: Actor, opts?: DefineCapabilitiesForOptions) {
  return <const CapabilityName extends string, Target = undefined>(
    resolver: CapabilityName[] | ((actor: Actor) => CapabilityResolver<Target, CapabilityName>),
  ) => {
    return defineCapabilityQueryBuilder({
      resolver: Array.isArray(resolver) ? resolver : resolver(actor),
      opts,
    })
  }
}

function defineCapabilityQueryBuilder<Resolver extends CapabilityResolver<any, any>>({
  resolver,
  opts,
}: {
  resolver: Resolver
  opts?: DefineCapabilitiesForOptions
}) {
  function collect(args: inferResolverArgs<Resolver>): inferCapabilitiesFromResolver<Resolver>[] {
    if (typeof resolver === 'function') {
      const generatorOrCapabilities = resolver(args)

      if (Array.isArray(generatorOrCapabilities)) {
        // eslint-disable-next-line ts/no-unsafe-return
        return generatorOrCapabilities
      }

      // eslint-disable-next-line ts/no-unsafe-return
      return collectGenerator(generatorOrCapabilities)
    }

    // eslint-disable-next-line ts/no-unsafe-return
    return resolver
  }

  type Args = inferResolverArgs<Resolver>

  return {
    can: <Capability extends inferCapabilitiesFromResolver<Resolver>>(
      capability: Capability,
      ...args: undefined extends Args ? [args?: Args] : [args: Args]
    ) => {
      return {
        check: (): boolean => collect(args[0] as Args).includes(capability),
        throw: () => {
          const checkSuccess = collect(args[0] as Args).includes(capability)
          if (checkSuccess) return

          const message = `User does not have capability ${capability}`

          throw opts?.createError?.(message) ?? new Error(message)
        },
      }
    },
  }
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
