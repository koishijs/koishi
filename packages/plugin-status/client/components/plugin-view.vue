<template>
  <li class="plugin-view" :class="{ 'has-children': data.children.length }">
    <i class="el-icon-caret-right" :class="{ show }"/>
    <span class="plugin-item" @click="show = !show" :class="state">{{ data.name }}</span>
    <el-collapse-transition v-if="data.children.length">
      <ul class="plugin-list" v-show="show">
        <plugin-view :data="data" v-for="(data, index) in data.children" :key="index" />
      </ul>
    </el-collapse-transition>
  </li>
</template>

<script setup lang="ts">

import type { PluginData } from '~/server'
import { ref, computed, defineProps } from 'vue'

const show = ref(false)

const props = defineProps<{ data: PluginData }>()

const state = computed(() => {
  return props.data.sideEffect ? 'side-effect' : 'normal'
})

</script>

<style lang="scss">

@import '../index.scss';

:not(.has-children) > .el-icon-caret-right {
  font-size: 16px !important;
  width: 10px;
  padding-left: 4px;

  &::before {
    content: "•";
  }
}

.el-icon-caret-right {
  margin-left: -1rem;
  margin-right: 1rem;
  transition: 0.3s ease;
  font-size: 14px !important;
  vertical-align: middle !important;
}

.el-icon-caret-right.show {
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
