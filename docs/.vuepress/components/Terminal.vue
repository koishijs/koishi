<script>

import { h } from 'vue'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function type(line, item, text, typeDelay) {
  if (!text) return
  const chars = [...text]
  line.content.push(item)
  for (let char of chars) {
    await sleep(typeDelay)
    item.text += char
  }
}

export default {
  props: {
    title: String,
    static: Boolean,
    content: { type: Array, required: true },
    startDelay: { type: Number, default: 600 },
    endDelay: { type: Number, default: 1000 },
    typeDelay: { type: Number, default: 100 },
    lineDelay: { type: Number, default: 100 },
  },

  data () {
    return {
      lines: this.getLines(),
    }
  },

  watch: {
    content () {
      this.lines = this.getLines()
      if (this.static) {
        return this.startStatic()
      }
    },
  },

  async mounted () {
    if (this.static) {
      return this.startStatic()
    }
    while (1) {
      await this.start()
    }
  },

  methods: {
    getLines () {
      return this.content.map(line => ({
        content: [],
        ...line,
        shown: false,
        active: false,
      }))
    },

    startStatic () {
      this.lines.forEach(line => line.shown = true)
    },

    async start() {
      await sleep(this.startDelay)
      this.lines.forEach(line => line.shown = false)

      for (const line of this.lines) {
        line.shown = true
        const lineDelay = line.lineDelay || this.lineDelay
        if (!line.type) {
          await sleep(lineDelay)
          continue
        }

        const typeDelay = line.typeDelay || this.typeDelay
        if (line.type === 'select') {
          line.content = [
            { text: '? ', class: 'prefix' },
            { text: line.message, class: 'message' },
            { text: ' » ' + line.hint, class: 'hint' },
          ]
          for (const choice of line.choices) {
            line.content.push({ tag: 'br' }, { text: '    ' + choice, class: '' })
          }
          let index = 4
          line.content[index].class = 'accent'
          line.content[index].text = '>' + line.content[index].text.slice(1)
          for (const action of line.actions) {
            await sleep(typeDelay)
            line.content[index].class = ''
            line.content[index].text = ' ' + line.content[index].text.slice(1)
            if (action === '1') {
              index += 2
            } else if (action === '2') {
              index -= 2
            }
            line.content[index].class = 'accent'
            line.content[index].text = '>' + line.content[index].text.slice(1)
          }
          await sleep(lineDelay)
          const text = line.content[index].text.slice(4)
          line.content[0] = { text: '√ ', class: 'success' }
          line.content[2].text = ' » '
          line.content.splice(3, Infinity, { text })
          continue
        }

        line.content = []
        if (line.type === 'question') {
          line.content.push(
            { text: '? ', class: 'prefix' },
            { text: line.message, class: 'message' },
            { text: ' » ', class: 'hint' },
          )
        } else if (line.type === 'input') {
          line.content.push({ text: '$ ', class: 'prefix' })
        }
        line.active = true
        if (line.type === 'input') {
          const [prefix] = line.text.split(' ', 1)
          await type(line, { text: '', class: 'input' }, prefix, typeDelay)
          await type(line, { text: '' }, line.text.slice(prefix.length), typeDelay)
        } else {
          await type(line, { text: '' }, line.text, typeDelay)
        }
        await sleep(lineDelay)
        if (line.type === 'question') {
          line.content[0] = { text: '√ ', class: 'success' }
        }
        line.active = false
      }

      await sleep(this.endDelay)
    },
  },

  render () {
    const mini = !this.title && this.static
    return h('panel-view', {
      class: 'terminal',
      style: {
        height: (this.lines.length * 1.4 + (mini ? 2 : 3.4)) * 16 + 'px',
      },
      props: {
        title: '命令行',
        controls: !mini,
      },
    }, this.lines.map(({ type, active, content, shown }, index) => {
      const children = content.map(child => typeof child === 'string'
        ? child
        : h(child.tag || 'span', { class: child.class }, child.text))
      return h('div', {
        key: index,
        class: ['line', type, { active, shown }],
      }, children)
    }))
  },
}

</script>

<style lang="scss">

$textShadow: 1px 1px 1px rgba(23, 31, 35, 0.5);

.terminal.panel-view {
  color: #eeeeee;
  background-color: #032f62;
  overflow: auto;

  .content {
    padding: 2.4rem 1.2rem 1rem !important;
    text-shadow: $textShadow;
  }

  &.mini .content {
    padding-top: 1rem !important;
  }
}

.terminal .line {
  line-height: 1.4rem;
  font-size: 0.85em;
  white-space: pre;
  font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace;

  &::after {
    content: ' ';
  }

  &:not(.shown) {
    display: none;
  }

  &.active::after {
    content: '▋';
    font-family: monospace;
    animation: blink 1s infinite;
  }

  .variable {
    color: #ffa500;
  }

  .string {
    color: #3fbfff;
  }

  .hint {
    color: #9f9f9f;
  }

  .input {
    color: #ffff00;
  }

  .prefix {
    color: #3fbfff;
  }

  .info {
    color: #3fbfff;
  }

  .accent {
    color: #3fbfff;
    font-weight: bold;
  }

  .message {
    color: #ffffff;
    font-weight: bold;
  }

  .success {
    color: #7fff00;
  }
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

</style>
