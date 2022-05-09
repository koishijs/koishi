const { setupForFile, transformAttributesToHTML } = require('remark-shiki-twoslash')
const { ScriptTarget, ModuleKind, ModuleResolutionKind } = require('typescript')

const twoslashSupportedList = ['ts', 'twoslash']
const extraHeader = require('fs').readFileSync(
  require('path').resolve(__dirname, 'header.ts')
)

let twoslashHighlighters

async function setup() {
  const { highlighters } = await setupForFile({
    theme: 'monokai',
  })
  twoslashHighlighters = highlighters
}

function render(code, lang, attrs) {
  if (process.env.NODE_ENV !== 'production') return null

  if (!twoslashSupportedList.includes(lang)) return null

  try {
    const attrList = attrs.split(' ').map((x) => x.trim())
    if (attrList.includes('no-twoslash')) return null
    let twoslashCode = attrList.includes('no-extra-header')
      ? code
      : extraHeader + code
    twoslashCode = twoslashCode.replace(/\r?\n$/, '')
    const html = transformAttributesToHTML(
      twoslashCode,
      [lang, 'twoslash', attrs].join(' '),
      twoslashHighlighters,
      {
        defaultCompilerOptions: {
          strict: false,
          target: ScriptTarget.ESNext,
          module: ModuleKind.ESNext,
          moduleResolution: ModuleResolutionKind.NodeJs,
          types: [
            '@koishijs/client/global',
          ],
        },
      },
    )
    return html
      .replace(/<div class="language-id">.+?<\/div>/, '')
      .replace(/<div class='line'/g, '<span class="line"')
      .replace(/<\/div>(?!<\/pre>)/g, '</span>\n')
      .replace(/<\/br>/g, '\n')
  } catch (e) {
    console.log('Code block:')
    console.log(code)
    console.log()
    console.log('Message:')
    console.log(e.message)
    console.log()
    return null
  }
}

module.exports = {
  setup,
  render,
}
