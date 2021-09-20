<template>
  <k-card class="page-logs frameless" scrollbar>
    <div class="logs">
      <div class="line" v-for="line in logs.split('\n')">
        <code v-html="converter.ansi_to_html(line)"></code>
      </div>
    </div>
  </k-card>
</template>

<script lang="ts" setup>

import { logs } from '~/client'
import Converter from 'ansi_up'

const converter = new Converter()

</script>

<style lang="scss">

.page-logs {
  height: calc(100vh - 4rem);
  color: var(--terminal-fg);
  background-color: var(--terminal-bg);

  .logs {
    padding: 1rem 1rem;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  }

  .line {
    padding: 0 0.5rem;
    border-radius: 2px;
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;

    &:hover {
      color: var(--terminal-fg-hover);
      background-color: var(--terminal-bg-hover);
    }
  }
}

</style>
