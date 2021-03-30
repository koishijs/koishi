<template>
  <li class="plugin-view" :class="{ 'has-children': data.children.length }">
    <i class="fas fa-caret-right" :class="{ show }"/>
    <span class="plugin-item" @click="data.children.length && (show = !show)" :class="state">{{ data.name }}</span>
    <k-collapse v-if="data.children.length">
      <ul class="plugin-list" v-show="show">
        <plugin-view :data="data" v-for="(data, index) in data.children" :key="index" />
      </ul>
    </k-collapse>
  </li>
</template>

<script setup lang="ts">

import type { Registry } from '~/server'
import { ref, computed, defineProps } from 'vue'

const show = ref(false)

const props = defineProps<{ data: Registry.PluginData }>()

const state = computed(() => {
  return props.data.sideEffect ? 'side-effect' : 'normal'
})

</script>

<style lang="scss">

@import '../../index.scss';

:not(.has-children) > .fa-caret-right {
  font-size: 16px !important;
  width: 16px;
  transform: translateX(-1px);

  &::before {
    content: "•";
  }
}

.fa-caret-right {
  margin-right: 8px;
  transition: 0.3s ease;
  font-size: 14px !important;
  width: 14px;
  text-align: center;
  vertical-align: middle !important;
}

.fa-caret-right.show {
  transform: rotate(90deg);
}

.plugin-item {
  line-height: 1.6;
  user-select: none;

  .has-children > & {
    cursor: pointer;
  }

  &.normal {
    color: $default;
  }

  &.side-effect {
    color: $error;
  }
}

.plugin-list {
  list-style-type: none;
}

</style>
