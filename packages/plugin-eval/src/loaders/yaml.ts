import { load } from 'js-yaml'

export const name = 'yaml'

export const isTextLoader = false

export function transformModule(source: string) {
  return load(source)
}
