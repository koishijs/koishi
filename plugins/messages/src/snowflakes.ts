const epoch = 1574773581000n // Tue Nov 26 21:06:21 2019 +0800, \koishi/
const TIMESTAMP_SHIFT = 22n

let increment = 0n

function snowflakes() {
  const ts = Date.now()
  const result = ((BigInt(ts) - BigInt(epoch)) << TIMESTAMP_SHIFT)
    + (increment++)
  increment %= 0xFFFn
  return result
}

// https://discord.com/developers/docs/reference#snowflakes
export function toTimestamp(id: bigint) {
  const ts = (BigInt(id) >> TIMESTAMP_SHIFT) + epoch
  return ts
}

export default snowflakes
