<template>
  <transition name="overlay">
    <div class="image-viewer" v-if="shared.overlayImage" @click="setImage(null)">
      <span class="button left" :class="{ disabled: !siblings.prev }" @click.stop="setImage(siblings.prev)">
        <k-icon name="chevron-left"/>
      </span>
      <span class="button right" :class="{ disabled: !siblings.next }" @click.stop="setImage(siblings.next)">
        <k-icon name="chevron-right"/>
      </span>
      <span class="button bottom" @click.stop>
        <el-tooltip placement="top" content="缩小" :offset="20">
          <k-icon name="search-minus" @click="scale -= 0.2"/>
        </el-tooltip>
        <el-tooltip placement="top" content="放大" :offset="20">
          <k-icon name="search-plus" @click="scale += 0.2"/>
        </el-tooltip>
        <el-tooltip placement="top" content="复原" :offset="20">
          <k-icon name="expand" @click="scale = 1, rotate = 0"/>
        </el-tooltip>
        <el-tooltip placement="top" content="逆时针旋转" :offset="20">
          <k-icon name="undo" @click="rotate -= 90"/>
        </el-tooltip>
        <el-tooltip placement="top" content="逆时针旋转" :offset="20">
          <k-icon name="redo" @click="rotate += 90"/>
        </el-tooltip>
      </span>
      <transition appear :duration="1" @before-appear="moveToOrigin" @after-appear="moveToCenter">
        <img ref="img" :style="{ transform }" :src="shared.overlayImage.src"/>
      </transition>
    </div>
  </transition>
</template>

<script lang="ts" setup>

import { shared } from './utils'
import { computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'

const scale = ref(1)
const rotate = ref(0)
const img = ref<HTMLImageElement>(null)

const transform = computed(() => {
  return `scale(${scale.value}) rotate(${rotate.value}deg)`
})

const siblings = computed(() => {
  if (!shared.overlayImage) return
  const elements = Array.from(document.querySelectorAll<HTMLImageElement>('.chat-image'))
  const index = elements.indexOf(shared.overlayImage)
  return {
    prev: elements[index - 1],
    next: elements[index + 1],
  }
})

const defaultScale = computed(() => {
  const { naturalHeight, naturalWidth } = shared.overlayImage
  const maxHeight = innerHeight - paddingVertical * 2
  const maxWidth = innerWidth - paddingHorizontal * 2
  return Math.min(1, maxHeight / naturalHeight, maxWidth / naturalWidth)
})

watch(() => shared.overlayImage, (el, origin) => {
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
  shared.overlayImage = el
}

function moveToOrigin(el: HTMLImageElement, origin = shared.overlayImage) {
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
  const { naturalHeight, naturalWidth } = shared.overlayImage
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
  if (!shared.overlayImage) return
  ev.preventDefault()
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
    setImage(siblings.value.prev)
  } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
    setImage(siblings.value.next)
  } else if (ev.key === 'Escape') {
    setImage(null)
  } else if (ev.key === 'Enter') {
    shared.overlayImage.offsetParent.scrollIntoView({ behavior: 'smooth' })
    setImage(null)
  }
}

</script>

<style lang="scss">

@use "sass:math";

$buttonSize: 3rem;
$buttonBg: #303133;

.overlay-enter-from, .overlay-leave-to {
  opacity: 0;
}

.overlay-enter, .overlay-leave {
  opacity: 1;
}

.image-viewer {
  position: fixed;
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

    .k-icon {
      transition: 0.4s ease;
      height: 1.25rem;
    }

    &:not(.disabled):hover {
      opacity: 0.8;
    }

    &:not(.disabled) .k-icon:hover {
      color: rgba(244, 244, 245, .8);
    }

    @each $tag in left, right {
      &.#{$tag} {
        top: 50%;
        z-index: 2000;
        transform: translateY(-50%);
        width: $buttonSize;
        #{$tag}: $buttonSize;
        .k-icon {
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
