<template>
  <div class="homepage" ref="root">
    <component v-for="(screen, index) in screens" :key="index" :is="screen" @scroll-screen="scroll"></component>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import Screen1 from './screen-1.vue'
import Screen2 from './screen-2.vue'
import Screen3 from './screen-3.vue'
import Screen4 from './screen-4.vue'
import Screen5 from './screen-5.vue'
import Screen6 from './screen-6.vue'

const screens = [
  Screen1,
  Screen2,
  Screen3,
  Screen4,
  Screen5,
  Screen6,
]

const root = ref<HTMLElement>()

useEventListener('wheel', (event) => {
  if (Math.abs(event.deltaY) < 100 || event.ctrlKey || event.shiftKey) return
  event.preventDefault()
  scroll(Math.sign(event.deltaY))
}, { passive: false })

function scroll(scale = 1) {
  root.value.scrollBy({
    top: innerHeight * scale,
    behavior: 'smooth',
  })
}

</script>

<style lang="scss">

.homepage {
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  height: 100vh;
  overflow-y: auto;
  display: grid;
  grid-template-rows: repeat(5, 100vh);
  scroll-snap-type: y mandatory;

  .screen.flex {
    padding: 6rem;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    @media (max-width: 720px) {
      padding: 4rem;
    }

    @media (max-width: 480px) {
      padding: 4rem 2.4rem;
    }
  }

  .introduction.center {
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 2.2rem;
    font-weight: 400;

    @media (max-width: 720px) {
      font-size: 2rem;
    }
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 400;

    @media (max-width: 720px) {
      font-size: 1.3rem;
    }
  }

  > :nth-child(2n+1) {
    border-bottom: 1px solid var(--c-border);
    border-top: 1px solid var(--c-border);
    background-color: var(--c-bg-home);
    transition: var(--t-color);
  }
}

.screen {
  --c-text: var(--c-text-home);
  color: var(--c-text);
  transition: var(--t-color);
  scroll-snap-align: start;
}

.feature-view {
  max-width: 80rem;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
  justify-items: center;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    .image {
      display: none;
    }
  }

  img {
    border: 1px solid var(--c-border);
    max-height: 100%;
    max-width: 640px;
  }
}

</style>
