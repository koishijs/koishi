/* eslint-disable */
// @ts-nocheck
function o(e, t, n) {
  for (
    var r = [], o = Math.max(e.length, t.length), i = 0, a = 0;
    a < o || i;

  ) {
    const s = i + (a < e.length ? e[a] : 0) + (a < t.length ? t[a] : 0)
    r.push(s % n), (i = Math.floor(s / n)), a++
  }
  return r
}

function i(e, t, n) {
  if (e < 0) return null
  if (0 == e) return []
  for (var r = [], i = t; 1 & e && (r = o(r, i, n)), 0 !== (e >>= 1);) { i = o(i, i, n) }
  return r
}

function a(e, t, n) {
  const r = (function (e, t) {
    for (var n = e.split(''), r = [], o = n.length - 1; o >= 0; o--) {
      const i = parseInt(n[o], t)
      if (isNaN(i)) return null
      r.push(i)
    }
    return r
  })(e, t)
  if (null === r) return null
  for (var a = [], s = [1], c = 0; c < r.length; c++) { r[c] && (a = o(a, i(r[c], s, n), n)), (s = i(t, s, n)) }
  let u = ''
  for (c = a.length - 1; c >= 0; c--) u += a[c].toString(n)
  return u
}

class Flake {
  seq;
  mid;
  timeOffset;
  lastTime;
  constructor(e) {
    e = e || {}
    this.seq = 0
    this.mid = (e.mid || 1) % 1023
    this.timeOffset = e.timeOffset || 0
    this.lastTime = 0
  }

  gen() {
    const e = Date.now(),
      t = (e - this.timeOffset).toString(2)
    if (this.lastTime == e) {
      if ((this.seq++, this.seq > 4095)) for (this.seq = 0; Date.now() <= e;);
    } else this.seq = 0
    this.lastTime = e
    let n = this.seq.toString(2),
      r = this.mid.toString(2)
    for (; n.length < 12;) n = '0' + n
    for (; r.length < 10;) r = '0' + r
    const o = t + r + n
    let i = ''
    for (let a = o.length; a > 0; a -= 4) { i = parseInt(o.substring(a - 4, a), 2).toString(16) + i }
    return (
      '0x' === (s = i).substring(0, 2) && (s = s.substring(2)),
      a((s = s.toLowerCase()), 16, 10)
    )
    let s
  }
}

const timeOffset = 16067808e5
export const flake = new Flake({ mid: 42, timeOffset })
