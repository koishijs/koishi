export function parseHost(target: string): [host: string, id: string] {
  const index = target.indexOf(':')
  const host = target.slice(0, index)
  const id = target.slice(index + 1)
  return [host, id] as any
}
