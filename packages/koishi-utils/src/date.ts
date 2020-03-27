let timezoneOffset = new Date().getTimezoneOffset()

export function setTimezoneOffset (offset: number) {
  timezoneOffset = offset
}

export function getDateNumber (date: number | Date = new Date(), offset?: number) {
  if (typeof date === 'number') date = new Date(date)
  if (offset === undefined) offset = timezoneOffset
  return Math.floor((date.valueOf() / 60000 - offset) / 1440)
}

export function fromDateNumber (value: number, offset?: number) {
  const date = new Date(value * 86400000)
  if (offset === undefined) offset = timezoneOffset
  return new Date(+date + offset * 60000)
}
