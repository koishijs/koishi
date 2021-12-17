function getRoutes() {
  let routes = {}

  Array.from(document.querySelectorAll('.http-req')).map(el => {
    const [title, verb, url] = el.children
    ;(routes[url.innerText] ||= []).push([verb.innerText, title.innerText[0].toLowerCase() + title.innerText.slice(1).replace(/[ -]/g, '')])
  })

  return 'Internal.define({' + Object.entries(routes).map(([url, methods]) => {
    return `\n  '${url}': {${methods.map(([verb, name]) => `\n    ${verb}: '${name}',`).join('')}\n  },`
  }).join('') + '\n})'
}
