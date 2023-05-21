// make sure the signature is compatible with @intlify/core-base
import { deduplicate } from 'cosmokit'

export type LocaleTree = { [key in string]: LocaleTree }

export namespace LocaleTree {
  export function from(locales: string[]) {
    const tree: LocaleTree = {}
    for (const locale of locales.filter(Boolean)) {
      const tokens = locale.split('-')
      let current = tree
      for (let i = 0; i < tokens.length; i++) {
        const locale = tokens.slice(0, i + 1).join('-')
        current = current[locale] = current[locale] || {}
      }
    }
    return tree
  }
}

type LocaleEntry = readonly [string, LocaleEntry[]]

function toLocaleEntry(key: string, tree: LocaleTree): LocaleEntry {
  return [key, [[key, []], ...Object.entries(tree).map(([key, value]) => toLocaleEntry(key, value))]]
}

function* traverse([key, children]: LocaleEntry, ignored: LocaleEntry[]): Generator<string> {
  if (!children.length) {
    return yield key
  }
  for (const child of children) {
    if (ignored.includes(child)) continue
    yield* traverse(child, ignored)
  }
}

export function fallback(tree: LocaleTree, locales: string[]): string[] {
  const root = toLocaleEntry('', tree)
  const ignored: LocaleEntry[] = []
  for (const locale of deduplicate(locales).filter(Boolean).reverse()) {
    let prefix = '', children = root[1]
    const tokens = locale ? locale.split('-') : []
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!
      const current = prefix + token
      const index = children.findIndex(([key]) => key === current)
      if (index < 0) break
      const entry = children[index]
      if (index > 0) {
        children.splice(index, 1)
        children.unshift(entry)
      }
      children = entry[1]
      prefix = current + '-'
      if (current === locale) {
        ignored.unshift(entry)
      }
    }
  }
  ignored.push(root)
  const results: string[] = []
  for (const entry of ignored) {
    results.push(...traverse(entry, ignored))
  }
  return results
}
