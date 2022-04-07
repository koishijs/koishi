import { Intersect } from '@koishijs/utils'

export type Values<S> = S[keyof S]

export type Keys<O, T = any> = Values<{
  [K in keyof O]: O[K] extends T ? K : never
}> & string

export type Atomic = number | string | boolean | bigint | symbol | Date
export type Indexable = string | number
export type Comparable = string | number | Date
export type Common = string | number | boolean | Date

type FlatWrap<S, T, P extends string> = { [K in P]?: S }
  // rule out atomic / recursive types
  | (S extends Atomic | T ? never
  // rule out dict / infinite types
  : string extends keyof S ? never
  : FlatMap<S, T, `${P}.`>)

type FlatMap<S, T = never, P extends string = ''> = Values<{
  [K in keyof S & string as `${P}${K}`]: FlatWrap<S[K], S | T, `${P}${K}`>
}>

export type Flatten<S> = Intersect<FlatMap<S>>
