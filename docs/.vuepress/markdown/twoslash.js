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
    const ci = 'GITHUB_ACTIONS' in process.env
    const blue = (x) => `\u001b[34m${x}\u001b[0m\n`
    const startGroup = (x) => ci ? `::group::${x}` : `${blue('----- ' + x)}\n`
    const endGroup = () => ci ? '::endgroup::' : `${blue('-----')}\n`

    if ('recommendation' in e && 'code' in e) {
      // Twoslash error
      console.log(startGroup('Twoslash Compiler Error'))
      console.log(blue('Code:'))
      console.log(e.code)
      console.log(blue('Error:'))
      console.log(e.recommendation)
    } else {
      // Other error
      console.log(startGroup('Twoslash Error'))
      console.log(blue('Code:'))
      console.log(code)
      console.log(blue('Error:'))
      console.log(e.message)
    }

    console.log(endGroup())
    return null
  }
}

module.exports = {
  setup,
  render,
}
