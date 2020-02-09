export function getDateNumber (date: number | Date = new Date()) {
  if (typeof date === 'number') date = new Date(date)
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

export function fromDateNumber (value: number) {
  const date = new Date(value * 86400000)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
