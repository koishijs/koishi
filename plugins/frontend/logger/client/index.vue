<template>
  <k-card class="page-logs frameless" scrollbar>
    <div ref="root" class="logs">
      <div class="line" :class="{ start: line.includes(hint) }" v-for="line in store.logs">
        <code v-html="renderLine(line)"></code>
      </div>
    </div>
  </k-card>
</template>

<script lang="ts" setup>

import { watch, ref, nextTick, onMounted } from 'vue'
import { store, receive } from '@koishijs/client'
import Converter from 'ansi_up'

const root = ref<HTMLElement>()

const hint = `app\u001b[0m \u001b[38;5;15;1mKoishi/`

const converter = new Converter()

function renderLine(line: string) {
  return converter.ansi_to_html(line)
}

onMounted(() => {
  const wrapper = root.value.parentElement.parentElement.parentElement
  wrapper.scrollTop = wrapper.scrollHeight
})

watch(() => store.logs.length, async () => {
  const wrapper = root.value.parentElement.parentElement.parentElement
  const { scrollTop, clientHeight, scrollHeight } = wrapper
  if (Math.abs(scrollTop + clientHeight - scrollHeight) < 1) {
    await nextTick()
    wrapper.scrollTop = scrollHeight
  }
})

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

  .logs .line.start {
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

  .logs:first-child .line:first-child {
    margin-top: 0;

    &::before {
      display: none;
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
