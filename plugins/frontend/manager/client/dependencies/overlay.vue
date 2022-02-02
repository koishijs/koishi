<template>
  <transition name="fade">
    <div class="loading-overlay" v-if="!state.downloading">
      <div class="spinner">
        <svg class="circular" viewBox="25 25 50 50">
          <circle class="path" cx="50" cy="50" r="20" fill="none"></circle>
        </svg>
        <p>正在更新依赖……</p>
      </div>
    </div>
  </transition>
</template>

<script lang="ts" setup>

import { state } from '../utils'

</script>

<style lang="scss">

.loading-overlay {
  position: fixed;
  left: 0;
  bottom: 0;
  top: 0;
  right: 0;
  z-index: 1000;
  transition: 0.4s opacity ease;
  user-select: none;
  background-color: #0009;

  .spinner {
    top: 50%;
    width: 100%;
    text-align: center;
    position: absolute;
    transform: translateY(-50%);

    p {
      color: var(--bg0);
      margin-bottom: 0;
    }

    svg {
      display: inline;
      height: 2.5rem;
      width: 2.5rem;
      animation: loading-rotate 2s linear infinite;

      circle {
        animation: loading-dash 1.5s ease-in-out infinite;
        stroke-dasharray: 90, 150;
        stroke-dashoffset: 0;
        stroke-width: 3;
        stroke: var(--el-color-primary);
        stroke-linecap: round;
      }
    }
  }
}

</style>
