import { Context, segment } from 'koishi'
import { Socket } from 'net'

function itob(n: number, length: number) {
  const result = []
  while (n > 0 || result.length < length) {
    const digit = n & 0xff
    result.unshift(digit)
    n >>= 8
  }
  return result
}

export const name = 'mcping'

export function apply(ctx: Context) {
  ctx.command('tools/mcping <url>', '查看 Minecraft 服务器信息')
    .action(async ({ session }, address) => {
      if (!address) return '请输入正确的网址。'
      if (!address.match(/^\w+:\/\//)) address = 'http://' + address

      let host: string, port: number
      try {
        const url = new URL(address)
        host = url.hostname
        port = Number(url.port) || 25565
      } catch (error) {
        return '请输入正确的网址。'
      }

      const socket = new Socket()

      const PacketID = Buffer.from([0])
      const ProtocolVersion = Buffer.from([242, 3])
      const ServerAddressContent = Buffer.from(host, 'ascii')
      const ServerAddressLength = Buffer.from(itob(ServerAddressContent.length, 1))
      const ServerAddress = Buffer.concat([ServerAddressLength, ServerAddressContent])
      const ServerPort = Buffer.from(itob(port, 2))
      const NextState = Buffer.from([1])
      const HandshakePacketContent = Buffer.concat([PacketID, ProtocolVersion, ServerAddress, ServerPort, NextState])
      const HandshakePacketLength = Buffer.from(itob(HandshakePacketContent.length, 1))
      const HandshakePacket = Buffer.concat([HandshakePacketLength, HandshakePacketContent])
      const RequestPacket = Buffer.from([1, 0])

      let response = ''
      let bytes = 0
      let length = -1

      socket.connect(port, host, () => {
        socket.write(HandshakePacket)
        socket.write(RequestPacket)
      })

      socket.on('data', (data) => {
        let offset = 0
        if (length < 0) {
          const lowerByte = data[3]
          const higherByte = data[4]
          length = ((higherByte & 0x7f) << 7) | (lowerByte & 0x7f)
          offset = 5
        }
        response += data.slice(offset).toString()
        bytes += data.slice(offset).length
        if (bytes >= length) {
          try {
            const status = JSON.parse(response)
            if (!status.version) return '无法解析服务器信息。'
            const output = [
              `版本：${status.version.name}`,
              `人数：${status.players.online} / ${status.players.max}`,
            ]
            if (status.description) output.unshift(`简介：${status.description.text}`)
            // data:image/png;base64,
            if (status.favicon) output.unshift(segment.image('base64://' + status.favicon.slice(22)))
            session.send(output.join('\n'))
          } catch (error) {
            session.send('无法解析服务器信息。')
          }
        }
      })

      socket.setTimeout(5000, () => {
        socket.end()
        if (!response) session.send('服务器响应超时，请确认输入的地址。')
      })
      socket.on('error', () => {
        socket.destroy()
        session.send('无法获取服务器信息，请确认输入的地址。')
      })
    })
}
