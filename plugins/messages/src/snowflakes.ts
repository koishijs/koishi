const epoch = 1574773581000n // Tue Nov 26 21:06:21 2019 +0800, \koishi/
const TIMESTAMP_SHIFT = 22n

function snowflakes() {
  const ts = Date.now()
  return ((BigInt(ts) - BigInt(epoch)) << TIMESTAMP_SHIFT)
    + BigInt(Math.round(Math.random() * (Math.pow(2, 12) - 1)))
}

// https://discord.com/developers/docs/reference#snowflakes
export function toTimestamp(id: bigint) {
  const ts = (BigInt(id) >> TIMESTAMP_SHIFT) + epoch
  return ts
}

export default snowflakes
