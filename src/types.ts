// export type inferCapabilitiesFromResolver<E> = E extends string[]
//   ? E[number]
//   : E extends (...args: any[]) => infer R
//     ? R extends Generator<infer Yield, infer Return>
//       ?
//           | (Yield extends string[] ? Yield[number] : never)
//           | (Return extends string[] ? Return[number] : never)
//       : R extends string[]
//         ? R[number]
//         : never
//     : never

// export type CapabilityResolver<Actor, Subject, Capabilities extends string, Args> = (
//   ctx: CapabilityResolverContext<Actor, Subject, Args>,
// ) => Generator<Capabilities[], Capabilities[]>

// export type CapabilityResolverContext<Actor, Subject, Args> = {
//   actor: Actor
//   subject: Subject
//   args: Simplify<ObjectToDiscriminatedUnion<Args>>
// }

// export type inferResolverContext<Resolver> = [Resolver] extends [
//   CapabilityResolver<infer Actor, infer Subject, any, infer Args>,
// ]
//   ? CapabilityResolverContext<Actor, Subject, Args>
//   : never

// export type inferResolverArgs<Resolver> = [Resolver] extends [
//   CapabilityResolver<any, any, any, infer Args>,
// ]
//   ? Args
//   : never

// export type inferResolverCapabilities<Resolver> = [Resolver] extends [
//   CapabilityResolver<any, any, infer Capabilities, any>,
// ]
//   ? Capabilities
//   : never
