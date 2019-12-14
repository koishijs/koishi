export function contain (array1: readonly any[], array2: readonly any[]) {
  return array2.every(item => array1.includes(item))
}

export function intersection <T> (array1: readonly T[], array2: readonly T[]) {
  return array1.filter(item => array2.includes(item))
}

export function difference <S> (array1: readonly S[], array2: readonly any[]) {
  return array1.filter(item => !array2.includes(item))
}

export function union <T> (array1: readonly T[], array2: readonly T[]) {
  return Array.from(new Set([...array1, ...array2]))
}
