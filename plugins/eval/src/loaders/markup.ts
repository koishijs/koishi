import { load } from 'js-yaml'

export const name = 'synthetize'
export const synthetize = true

export function transformModule(source: string, extension: string) {
  if (extension === '.json') {
    return JSON.parse(source)
  } else {
    return load(source)
  }
}
