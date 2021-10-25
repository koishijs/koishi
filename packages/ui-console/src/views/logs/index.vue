<template>
  <k-card class="page-logs frameless" scrollbar>
    <div class="logs">
      <div class="line" :class="{ start: line.includes(hint) }" v-for="line in logs.split('\n')">
        <code v-html="renderLine(line)"></code>
      </div>
    </div>
  </k-card>
</template>

<script lang="ts" setup>

import { logs } from '~/client'
import Converter from 'ansi_up'

const hint = `app\u001b[0m \u001b[38;5;15;1mKoishi/`

const converter = new Converter()

function renderLine(line: string) {
  return converter.ansi_to_html(line)
}

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

  .logs:not(:first-child) .line.start {
    margin-top: 1rem;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: -0.5rem;
      border-top: 1px solid var(--terminal-separator);
    }
  }

  .line {
    padding: 0 0.5rem;
    border-radius: 2px;
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
    position: relative;

    &:hover {
      color: var(--terminal-fg-hover);
      background-color: var(--terminal-bg-hover);
    }

    ::selection {
      background-color: var(--terminal-bg-selection);
    }
  }
}

</style>
