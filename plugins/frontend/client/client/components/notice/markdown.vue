<template>
  <component :is="tag ?? (inline ? 'p' : 'div')" class="k-markdown" v-html="render()"></component>
</template>

<script lang="ts" setup>

import { marked } from 'marked'

const props = defineProps({
  source: String,
  inline: Boolean,
  tag: String,
})

function render() {
  if (props.inline) {
    return marked.parseInline(props.source || '')
  } else {
    return marked(props.source || '')
  }
}

</script>

<style lang="scss">

.k-markdown {
  a, code a {
    color: var(--active);

    &:hover {
      text-decoration: underline;
    }
  }

  code {
    color: var(--fg2);
    padding: 0.25rem 0.5rem;
    background-color: var(--page-bg);
    border-radius: 3px;
    overflow-wrap: break-word;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
}

</style>
