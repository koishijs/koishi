/**
 * @param {HTMLElement} el
 */
function toComment(el) {
  let result = ''
  for (const node of el.childNodes) {
    if (node.nodeName === 'A') {
      result += `[${node.textContent}](${node.href})`
    } else {
      result += node.textContent
    }
  }
  return result
}

/**
 * @param {HTMLTableRowElement} el
 */
function toFieldDecl(el) {
  let field = el.children[0].textContent.replace(/[ *]/g, '')
  let type = el.children[1].textContent
  let desc = el.children[2]?.textContent
  if (type.startsWith('?')) {
    type = type.slice(1)
    if (!field.endsWith('?')) {
      field += '?'
    }
  }
  let prefix = suffix = ''
  if (type.startsWith('array of ') || type.startsWith('Array of ')) {
    type = type.slice(9).replace(/s$/, '')
    suffix = '[]'
  }
  if (type.startsWith('list of ')) {
    type = type.slice(8).replace(/s$/, '')
    suffix = '[]'
  }
  if (type.startsWith('partial ')) {
    prefix += 'Partial<'
    suffix = '>' + suffix
    type = type.slice(8)
  }
  if (type.startsWith('one of ')) {
    type = type.slice(7)
  }
  if (type.startsWith('a ')) {
    type = type.slice(2)
  }
  if (type.endsWith(' object') || type.endsWith(' string')) {
    type = type[0].toUpperCase() + type.slice(1, -7)
  }
  type = type.replace('ISO8601 ', '')
  type = type.replace(/ ./g, $0 => $0.slice(1).toUpperCase())
  let result = `  ${field}: ${prefix}${type}${suffix}`
  if (desc) result = `  /** ${desc} */\n` + result
  return result
}

/**
 * @param {HTMLTableRowElement} el
 */
function toValueDecl1(el) {
  let value = el.children[0].textContent
  let name = el.children[1].textContent.toUpperCase().replace(/ /g, '_')
  let desc = el.children[2]?.textContent
  let result = `  ${name} = ${value},`
  if (desc) result = `  /** ${desc} */\n` + result
  return result
}

/**
 * @param {HTMLTableRowElement} el
 */
function toValueDecl2(el) {
  let value = el.children[1].textContent
  const cap = /\((.+)\)/.exec(value)
  if (cap) value = cap[1]
  let name = el.children[0].textContent.toUpperCase().replace(/ *\*+$/, '').replace(/ /g, '_')
  let desc = el.children[2]?.textContent
  let result = `  ${name} = ${value},`
  if (desc) result = `  /** ${desc} */\n` + result
  return result
}

/**
 * @param {HTMLTableRowElement} el
 */
function toValueDecl3(el) {
  let value = el.children[0].textContent
  let desc = el.children[1]?.textContent
  let result = `  ${value} = '${value}',`
  if (desc) result = `  /** ${desc} */\n` + result
  return result
}

function generateDecls() {
  const output = []
  const { origin, pathname } = document.location
  for (const table of document.querySelectorAll('table')) {
    let header = table.previousSibling
    while (header.nodeName === 'DIV' || header.nodeName === 'P') header = header.previousSibling
    if (header.nodeName !== 'H6') continue

    const segments = header.textContent.split(' ')
    const type = segments.pop()

    if (type === 'Structure') {
      if (header.textContent === 'Response Structure') continue
      addDecl(`interface ${segments.join('')}`, toFieldDecl)
    } else if (type === 'Object' || type === 'Fields') {
      addDecl(`interface ${segments.join('')}`, toFieldDecl)
    } else if (type === 'Info') {
      addDecl(`interface ${segments.join('')}Info`, toFieldDecl)
    } else if (type === 'Flags' || type === 'Types' || type === 'Type' || type === 'Events' || type === 'Behaviors') {
      const callback = table.querySelector('th').textContent === 'Value' ? toValueDecl1 : toValueDecl2
      addDecl(`enum ${header.textContent.replace(/s$/, '').replace(/ /g, '')}`, callback)
    } else if (type === 'Features') {
      addDecl(`enum ${header.textContent.slice(0, -1).replace(/ /g, '')}`, toValueDecl3)
    } else if (type === 'Enum') {
      const callback = table.querySelector('th').textContent === 'Value' ? toValueDecl1 : toValueDecl2
      addDecl(`enum ${header.textContent.replace(/ /g, '')}`, callback)
    }

    function addDecl(fullname, callback) {
      output.push(`/** ${origin + pathname + '#' + header.id} */`)
      output.push(`export ${fullname} {`)
      output.push([...table.querySelector('tbody').children].map(callback).join('\n'))
      output.push('}\n')
    }
  }
  return output.join('\n')
}
