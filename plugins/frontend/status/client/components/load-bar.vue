<template>
  <div class="load-bar">
    <span class="title">{{ title }}</span>
    <span class="body">
      <span class="used bar" :style="{ width: percentage(rate[1] - rate[0]) }">
        <span v-if="mainly === 'used'" class="caption">{{ caption }}</span>
      </span>
      <span class="app bar" :style="{ width: percentage(rate[0]) }">
        <span v-if="mainly === 'app'" class="caption">{{ caption }}</span>
      </span>
      <span v-if="mainly === 'free'" class="caption">{{ caption }}</span>
    </span>
  </div>
</template>

<script lang="ts" setup>

import type { LoadRate } from '@koishijs/plugin-status/src'
import { computed } from 'vue'

const props = defineProps<{ rate: LoadRate, title: string }>()

function percentage(value: number, digits = 3) {
  return (value * 100).toFixed(digits) + '%'
}

const segments = ['used', 'app', 'free'] as const

const mainly = computed<typeof segments[number]>(() => {
  const length = [props.rate[1] - props.rate[0], props.rate[0], 1 - props.rate[1]]
  const index = length.indexOf(Math.max(...length))
  return segments[index]
})

const caption = computed(() => {
  return `${percentage(props.rate[0], 1)} / ${percentage(props.rate[1], 1)}`
})

</script>

<style lang="scss" scoped>

.load-bar {
  display: flex;
  align-items: center;
  user-select: none;
  font-size: 0.9em;

  .title {
    min-width: 3rem;
  }

  .body {
    width: 100%;
    height: 1.2rem;
    position: relative;
    display: inline;
    background-color: var(--bg1);
    border-radius: 4px;
    overflow: hidden;
    transition: color 0.3s ease, background-color 0.3s ease;
  }

  .bar {
    height: 100%;
    position: relative;
    float: left;
    transition: 0.3s ease;
  }

  .used {
    background-color: var(--primary);
    color: white;
    transition: color 0.3s ease, background-color 0.3s ease;
    &:hover {
      background-color: var(--primary-tint);
    }
  }

  .app {
    background-color: var(--warning);
    transition: color 0.3s ease, background-color 0.3s ease;
    &:hover {
      background-color: var(--warning-tint);
    }
  }

  .caption {
    left: 1rem;
    position: relative;
  }

  & + & {
    margin-top: 0.6rem;
  }
}

</style>