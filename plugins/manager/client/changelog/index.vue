<template>
  <template v-for="({ name, body, tag_name }) in store.releases" :key="tag_name">
    <k-card class="xxx">
      <h2>{{ name }}</h2>
      <k-markdown :source="transform(body)"></k-markdown>
    </k-card>
  </template>
</template>

<script lang="ts" setup>

import { store } from '~/client'
import { KMarkdown } from '../components'

function transform(source: string) {
  return source
    .replace(/^- .+@.+\r?\n/gm, '')
    .replace(/^#+ Other Changes[\s\S]+/gm, '')
    .replace(/^## /gm, '### ')
    .replace(/#(\d+)\b/g, (_, id) => {
      return `[#${id}](https://github.com/koishijs/koishi/issues/${id})`
    })
    .replace(/\(([0-9a-f]{40})\)/g, (_, hash) => {
      return `([\`${hash.slice(0, 7)}\`](https://github.com/koishijs/koishi/commit/${hash}))`
    })
}

</script>

<style lang="scss">

</style>
