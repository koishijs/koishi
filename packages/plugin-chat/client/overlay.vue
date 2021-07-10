<template>
  <transition name="fade">
    <div class="image-viewer" v-if="store.overlayImage" @click="setImage(null)">
      <span class="button left" :class="{ disabled: !siblings.prev }" @click.stop="setImage(siblings.prev)">
        <i class="fas fa-chevron-left"/>
      </span>
      <span class="button right" :class="{ disabled: !siblings.next }" @click.stop="setImage(siblings.next)">
        <i class="fas fa-chevron-right"/>
      </span>
      <span class="button bottom" @click.stop>
        <i class="fas fa-search-minus" @click="scale -= 0.2"/>
        <i class="fas fa-search-plus" @click="scale += 0.2"/>
        <i class="fas fa-expand" @click="scale = 1, rotate = 0"/>
        <i class="fas fa-undo" @click="rotate = (rotate - 90) % 180"/>
        <i class="fas fa-redo" @click="rotate = (rotate + 90) % 180"/>
      </span>
      <transition appear :duration="1" @before-appear="moveToOrigin" @after-appear="moveToCenter">
        <img ref="img" :style="{ transform }" :src="store.overlayImage.src"/>
      </transition>
    </div>
  </transition>
</template>

<script lang="ts" setup>

import { store } from '~/client'
import { computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'

const scale = ref(1)
const rotate = ref(0)
const img = ref<HTMLImageElement>(null)

const transform = computed(() => {
  return `scale(${scale.value}) rotate(${rotate.value}deg)`
})

const siblings = computed(() => {
  if (!store.overlayImage) return
  const elements = Array.from(document.querySelectorAll<HTMLImageElement>('.k-image'))
  const index = elements.indexOf(store.overlayImage)
  return {
    prev: elements[index - 1],
    next: elements[index + 1],
  }
})

const defaultScale = computed(() => {
  const { naturalHeight, naturalWidth } = store.overlayImage
  const maxHeight = innerHeight - paddingVertical * 2
  const maxWidth = innerWidth - paddingHorizontal * 2
  return Math.min(1, maxHeight / naturalHeight, maxWidth / naturalWidth)
})

watch(() => store.overlayImage, (el, origin) => {
  scale.value = 1
  rotate.value = 0
  if (!el) return moveToOrigin(img.value, origin)
  if (img.value) {
    img.value.style.transition = '0.3s transform ease'
    moveToCenter(img.value)
  }
})

function setImage(el: HTMLImageElement) {
  if (el === undefined) return
  store.overlayImage = el
}

function moveToOrigin(el: HTMLImageElement, origin = store.overlayImage) {
  const { height, width } = origin
  const { left, top } = origin.getBoundingClientRect()
  el.style.width = width + 'px'
  el.style.height = height + 'px'
  el.style.left = left + 'px'
  el.style.top = top + 'px'
  el.style.transition = '0.3s ease'
}

const paddingVertical = 0
const paddingHorizontal = 0

function moveToCenter(el: HTMLImageElement) {
  const { naturalHeight, naturalWidth } = store.overlayImage
  const scale = defaultScale.value
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  el.style.width = width + 'px'
  el.style.height = height + 'px'
  el.style.left = (innerWidth - width) / 2 + 'px'
  el.style.top = (innerHeight - height) / 2 + 'px'
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(ev: KeyboardEvent) {
  if (!store.overlayImage) return
  ev.preventDefault()
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
    setImage(siblings.value.prev)
  } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
    setImage(siblings.value.next)
  } else if (ev.key === 'Escape') {
    setImage(null)
  } else if (ev.key === 'Enter') {
    store.overlayImage.offsetParent.scrollIntoView({ behavior: 'smooth' })
    setImage(null)
  }
}

</script>

<style lang="scss">

@use "sass:math";

$buttonSize: 3rem;
$buttonBg: #303133;

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.fade-enter-to, .fade-leave-from {
  opacity: 1;
}

.image-viewer {
  position: absolute;
  left: 0;
  bottom: 0;
  top: 0;
  right: 0;
  z-index: 1000;
  transition: 0.4s opacity ease;
  user-select: none;
  background-color: #0006;

  .button {
    position: absolute;
    border-radius: $buttonSize;
    cursor: pointer;
    user-select: none;
    opacity: 0.5;
    font-size: math.div($buttonSize, 2);
    height: $buttonSize;
    background-color: $buttonBg;
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    transition: 0.4s ease;

    i {
      transition: 0.4s ease;
    }

    &:not(.disabled):hover {
      opacity: 0.8;
    }

    &:not(.disabled) i:hover {
      color: rgba(244, 244, 245, .8);
    }

    @each $tag in left, right {
      &.#{$tag} {
        top: 50%;
        z-index: 2000;
        transform: translateY(-50%);
        width: $buttonSize;
        #{$tag}: $buttonSize;
        i {
          margin-#{$tag}: -3px;
        }
      }
    }

    &.bottom {
      z-index: 2000;
      bottom: $buttonSize;
      width: $buttonSize * 6;
      left: 50%;
      transform: translateX(-50%);
    }

    &.disabled {
      cursor: not-allowed;
    }
  }

  img {
    position: absolute;
  }
}

</style>
