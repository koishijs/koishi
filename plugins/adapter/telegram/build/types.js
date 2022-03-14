function getDecls() {
  const payloads = {}
  const decls = [...document.querySelectorAll('h4')].map(header => {
    let table = header.nextElementSibling
    const comments = []
    while (table && table.tagName !== 'TABLE' && table.tagName !== 'H4') {
      comments.push(table.innerText)
      table = table.nextElementSibling
    }
    if (!table || table.tagName === 'H4') return
    const th = table.querySelector('th')
    comments.push('@see ' + header.querySelector('a').href)
    const comment = `/**\n * ${comments.join('\n * ')}\n */\n`
    if (th.innerText === 'Field') {
      return comment + `export interface ${header.innerText} {` + [...table.querySelectorAll('tbody tr')].map(tr => {
        const [field, type, desc] = tr.children
        return `\n  /** ${desc.innerText} */\n  ${field.innerText}?: ${type.innerText}`
      }).join('') + '\n}\n'
    } else if (th.innerText === 'Parameter') {
      const name = header.innerText[0].toUpperCase() + header.innerText.slice(1) + 'Payload'
      payloads[header.innerText] = name
      return comment + `export interface ${name} {` + [...table.querySelectorAll('tbody tr')].map(tr => {
        const [param, type, required, desc] = tr.children
        return `\n  /** ${desc.innerText} */\n  ${param.innerText}${required.innerText === 'YES' ? '' : '?'}: ${type.innerText}`
      }).join('') + '\n}\n'
    } else {
      console.log(table)
    }
  }).filter(el => el)
  decls.push('export interface Internal {' + Object.entries(payloads).map(([key, value]) => {
    return `\n  ${key}(payload: ${value}): Promise<void>`
  }).join('') + '\n}\n')
  return decls.join('\n')
}
