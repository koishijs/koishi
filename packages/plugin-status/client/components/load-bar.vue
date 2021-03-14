<template>
  <div class="load">
    <span class="title">{{ title }}</span>
    <span class="body" :class="mainly">
      <span class="used bar" :style="{ width: percentage(rate[1] - rate[0]) }">
        <span class="caption">{{ caption }}</span>
      </span>
      <span class="app bar" :style="{ width: percentage(rate[0]) }"/>
      <span class="caption">{{ caption }}</span>
    </span>
  </div>
</template>

<script lang="ts" setup>

import type { LoadRate } from '~/server'
import { defineProps, computed } from 'vue'

const props = defineProps<{ rate: LoadRate, title: string }>()

function percentage(value: number, digits = 3) {
  return (value * 100).toFixed(digits) + '%'
}

const mainly = computed(() => {
  return 1 + props.rate[0] > 2 * props.rate[1] ? 'free' : 'busy'
})

const caption = computed(() => {
  return `${percentage(props.rate[0], 1)} / ${percentage(props.rate[1], 1)}`
})

</script>

<style lang="scss">

.load {
  margin: 1rem 0;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  user-select: none;

  .title {
    min-width: 3rem;
  }

  .body {
    width: 100%;
    height: 1.2rem;
    position: relative;
    display: inline;
    background-color: #474d84;
    border-radius: 4px;
    overflow: hidden;
    &.busy > .caption, &.free .used > .caption {
      display: none;
    }
  }

  .bar {
    height: 100%;
    position: relative;
    float: left;
    transition: 0.6s ease;
  }

  .used {
    background-color: #2477ff;
    color: white;
    &:hover {
      background-color: lighten(#2477ff, 10%);
    }
  }

  .app {
    background-color: #e49400;
    &:hover {
      background-color: lighten(#e49400, 10%);
    }
  }

  .caption {
    left: 1rem;
    position: relative;
  }
}

</style>