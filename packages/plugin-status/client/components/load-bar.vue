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
    height: 1.6rem;
    position: relative;
    display: inline;
    background-color: #f6f8fa;
    &.busy > .caption, &.free .used > .caption {
      display: none;
    }
  }

  .bar {
    height: 100%;
    position: relative;
    float: left;
    transition: 0.6s ease;
    &:hover {
      z-index: 10;
      cursor: pointer;
      box-shadow: 0 0 4px #000c;
    }
  }

  .used {
    background-color: rgb(50,197,233);
    color: white;
    &:hover {
      background-color: rgb(55,216,255);
    }
  }

  .app {
    background-color: rgb(255,159,127);
    &:hover {
      background-color: rgb(255,174,139);
    }
  }

  .caption {
    left: 0.6rem;
    line-height: 1.7;
    position: relative;
  }
}

</style>