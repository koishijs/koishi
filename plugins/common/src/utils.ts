export function parseVariant(target: string): [variant: string, id: string] {
  const index = target.indexOf(':')
  const variant = target.slice(0, index)
  const id = target.slice(index + 1)
  return [variant, id] as any
}
