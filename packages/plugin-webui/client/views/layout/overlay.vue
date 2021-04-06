<template>
  <div id="overlay" :class="{ hidden: !store.overlayImage }" @click="onClick">
    <template v-if="store.overlayImage">
      <span class="button left" :class="{ disabled: !siblings.prev }" @click.stop="siblings.prev && (store.overlayImage = siblings.prev)">
        <i class="fas fa-chevron-left"/>
      </span>
      <span class="button right" :class="{ disabled: !siblings.next }" @click.stop="siblings.next && (store.overlayImage = siblings.next)">
        <i class="fas fa-chevron-right"/>
      </span>
    </template>
    <transition @before-enter="onBeforeEnter" @after-enter="onAfterEnter" :duration="{ enter: 1, leave: 400 }">
      <img ref="img" v-if="store.overlayImage" :src="store.overlayImage.src"/>
    </transition>
  </div>
</template>

<script lang="ts" setup>

import { store } from '~/client'
import { computed, watch, ref } from 'vue'

const img = ref<HTMLImageElement>(null)

const siblings = computed(() => {
  if (!store.overlayImage) return
  const elements = [...document.querySelectorAll<HTMLImageElement>('.k-image')]
  const index = elements.indexOf(store.overlayImage)
  return {
    prev: elements[index - 1],
    next: elements[index + 1],
  }
})

watch(() => store.overlayImage, (el, origin) => {
  if (!el) {
    onBeforeEnter(img.value, origin)
    return
  }
  if (img.value) {
    img.value.style.transition = null
    onAfterEnter(img.value)
  }
})

function onBeforeEnter(el: HTMLImageElement, origin = store.overlayImage) {
  const { height, width } = origin
  const { left, top } = origin.getBoundingClientRect()
  el.style.width = width + 'px'
  el.style.height = height + 'px'
  el.style.left = left + 'px'
  el.style.top = top + 'px'
  el.style.transition = '0.3s ease'
}

const paddingVertical = 72
const paddingHorizontal = 144

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

$buttonSize: 3rem;

#overlay {
  position: absolute;
  left: 0;
  bottom: 0;
  top: 0;
  right: 0;
  z-index: 1000;
  transition: 0.4s background-color ease;
  user-select: none;
  background-color: #0006;
  pointer-events: initial;

  &.hidden {
    background-color: #0000;
    pointer-events: none;

    .button {
      opacity: 0;
    }
  }

  .button {
    position: absolute;
    border-radius: 50%;
    cursor: pointer;
    user-select: none;
    opacity: 0.8;
    font-size: $buttonSize / 2;
    width: $buttonSize;
    height: $buttonSize;
    background-color: #606266;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.4s ease;
    top: 50%;
    transform: translateY(-50%);

    &.left {
      left: $buttonSize;
      i {
        margin-left: -3px;
      }
    }

    &.right {
      right: $buttonSize;
      i {
        margin-right: -3px;
      }
    }

    &.disable {
      pointer-events: none;
    }
  }

  img {
    position: absolute;
  }
}

</style>
