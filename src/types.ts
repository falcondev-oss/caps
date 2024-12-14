export type inferCapabilitiesFromResolver<E> = E extends string[]
  ? E[number]
  : E extends (...args: any[]) => infer R
    ? R extends Generator<infer Yield, infer Return>
      ?
          | (Yield extends string[] ? Yield[number] : never)
          | (Return extends string[] ? Return[number] : never)
      : R extends string[]
        ? R[number]
        : never
    : never

export type CapabilityResolver<Args, CapabilityName> =
  | ((args: Args) => CapabilityName[] | Generator<CapabilityName[], CapabilityName[]>)
  | CapabilityName[]

export type inferResolverArgs<Resolver> = [Resolver] extends [CapabilityResolver<infer Args, any>]
  ? Args
  : never
