import { segment } from 'koishi'
import { marked } from 'marked'

declare module 'marked' {
  namespace Tokens {
    interface Def {
      type: 'def'
    }

    interface Paragraph {
      tokens: marked.Token[]
    }
  }
}

function renderToken(token: marked.Token) {
  if (token.type === 'code') {
    return token.text + '\n'
  } else if (token.type === 'paragraph') {
    return render(token.tokens)
  } else if (token.type === 'image') {
    return segment.image(token.href)
  } else if (token.type === 'blockquote') {
    return token.text
  }
  return token.raw
}

function render(tokens: marked.Token[]) {
  return tokens.map(renderToken).join('')
}

export function transform(source: string) {
  if (!source) return ''
  source = source.replace(/^<!--(.*)-->$/gm, '')
  return render(marked.lexer(source)).trim().replace(/\n\s*\n/g, '\n')
}
