function getRoutes() {
  let routes = {}

  Array.from(document.querySelectorAll('.http-req')).map(el => {
    const [title, verb, url] = el.children
    ;(routes[url.innerText] ||= []).push([verb.innerText, camelize(title.innerText)])
  })

  return 'Internal.define({' + Object.entries(routes).map(([url, methods]) => {
    return `\n  '${url}': {${methods.map(([verb, name]) => `\n    ${verb}: '${name}',`).join('')}\n  },`
  }).join('') + '\n})'
}

function camelize(text) {
  return text[0].toLowerCase() + text.slice(1).replace(/[ -]/g, '')
}

function getRouteDecls() {
  return Array.from(document.querySelectorAll('.http-req')).map(el => {
    return [
      '    /**',
      '     * ' + el.nextElementSibling.innerText,
      '     * @see ' + el.querySelector('a').href,
      '     */',
      '    ' + camelize(el.children[0].innerText) + '(): Promise<void>',
    ].join('\n')
  }).join('\n')
}
