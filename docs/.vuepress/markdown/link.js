module.exports = {
  name: 'enhanced-links',

  extendsMarkdown (md) {
    const ruleLinkClose = md.renderer.rules.link_close
    md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
      const text = ruleLinkClose(tokens, idx, options, env, self)
      if (env.frontmatter.noOutboundLinks) {
        return text.replace('<OutboundLink/>', '')
      }
      return text
    }
  },
}
