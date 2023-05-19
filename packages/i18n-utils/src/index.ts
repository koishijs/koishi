// make sure the signature is compatible with @intlify/core-base

type LocaleTree = { [key in string]: LocaleTree }

export type FallbackLocale =
  | string
  | string[]
  | { [locale in string]: string[] }
  | false

export function fallback(tree: LocaleTree, locale: string): string[] {
  const tokens = locale ? locale.split('-') : []
  const locales: string[] = []
  tree = { ...tree }
  let prefix = ''
  const path: LocaleTree[] = [tree]
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const locale = prefix + token
    if (!(locale in tree)) break
    prefix = locale + '-'
    const parent = tree
    tree = { ...parent[locale] }
    delete parent[locale]
    path.push(tree)
  }
  tokens.splice(path.length - 1)
  function traverse(tree: LocaleTree) {
    for (const locale in tree) {
      locales.push(locale)
      traverse(tree[locale])
    }
  }
  do {
    tree = path.pop()!
    const locale = tokens.join('-')
    tokens.pop()
    locales.push(locale)
    traverse(tree)
  } while (path.length)
  return locales
}
