import bar from './bar.yml'

export function foo(index = 0) {
  return bar[index]
}
