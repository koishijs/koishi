<template>
  <component :is="tag" class="k-markdown" v-html="marked(source)"></component>
</template>

<script lang="ts" setup>

import marked from 'marked'

defineProps({
  source: String,
  tag: {
    type: String,
    default: 'div'
  },
})

</script>

<style lang="scss">

.k-markdown {
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
