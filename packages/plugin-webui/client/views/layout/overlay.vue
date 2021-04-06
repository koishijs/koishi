<template>
  <div id="overlay" :class="{ show: store.overlayImage }" @click="onClick">
    <transition @enter="onBeforeEnter" @after-enter="onAfterEnter">
      <img v-if="store.overlayImage" :src="store.overlayImage.src"/>
    </transition>
  </div>
</template>

<script lang="ts" setup>

import { store } from '~/client'

const paddingVertical = 100
const paddingHorizontal = 100

function onBeforeEnter(el: HTMLImageElement) {
  const { height, width } = store.overlayImage
  const { left, top } = store.overlayImage.getBoundingClientRect()
  el.style.width = width + 'px'
  el.style.height = height + 'px'
  el.style.left = left + 'px'
  el.style.top = top + 'px'
}

async function onAfterEnter(el: HTMLImageElement) {
  const { naturalHeight, naturalWidth } = store.overlayImage
  const maxHeight = innerHeight - paddingVertical * 2
  const maxWidth = innerWidth - paddingHorizontal * 2
  const scale = Math.min(1, maxHeight / naturalHeight, maxWidth / naturalWidth)
  const width = naturalWidth * scale, height = naturalHeight * scale
  el.style.width = width + 'px'
  el.style.height = height + 'px'
  el.style.left = (innerWidth - width) / 2 + 'px'
  el.style.top = (innerHeight - height) / 2 + 'px'
}

function onClick(ev: MouseEvent) {
  store.overlayImage = null
}

</script>

<style lang="scss">

#overlay {
  position: absolute;
  left: 0;
  bottom: 0;
  top: 0;
  right: 0;
  z-index: 1000;
  background-color: #0000;
  transition: 0.4s background-color ease;
  pointer-events: none;
  user-select: none;

  &.show {
    background-color: #0006;
    pointer-events: initial;
  }

  img {
    position: absolute;
    transition: 0.4s ease;
  }
}

</style>
