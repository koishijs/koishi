<template>
  <el-scrollbar class="plugin-select">
    <div class="content">
      <k-tab-item class="k-tab-group-title" label="" v-model="model">
        全局设置
      </k-tab-item>
      <div class="k-tab-group-title">
        运行中的插件
        <k-hint placement="right">
          <b>为什么一些插件没有显示？</b>
          <br>这里只展示直接从 app 注册的包形式的插件。换言之，在其他插件内部注册的插件或不是包的插件将不予显示。
        </k-hint>
      </div>
      <k-tab-group
        :data="store.packages" v-model="model"
        :filter="data => data.id" #="{ shortname, schema }">
        <span :class="{ readonly: !schema }">{{ shortname }}</span>
      </k-tab-group>
      <div class="k-tab-group-title">
        未运行的插件
        <k-hint placement="right" icon="fas fa-filter" :class="{ filtered }" @click="filtered = !filtered">
          <template v-if="filtered">
            <b>筛选：已开启</b><br>只显示支持在线配置的插件。
          </template>
          <template v-else>
            <b>筛选：已关闭</b><br>显示所有可用插件。
          </template>
        </k-hint>
      </div>
      <k-tab-group
        :data="store.packages" v-model="model"
        :filter="data => !data.id && (!filtered || data.schema)" #="{ shortname, schema }">
        <span :class="{ readonly: !schema }">{{ shortname }}</span>
      </k-tab-group>
      <template v-if="store.market">
        <div class="k-tab-group-title">
          待下载的插件
        </div>
        <k-tab-group :data="remote" v-model="model" #="{ name, shortname, schema }">
          <span :class="{ readonly: !schema }">{{ shortname }}</span>
          <i class="fas fa-times-circle" @click="remove(name)"></i>
        </k-tab-group>
      </template>
    </div>
  </el-scrollbar>
</template>

<script lang="ts" setup>

import { ref, computed } from 'vue'
import { store } from '~/client'
import { config } from '../utils'

const props = defineProps<{
  modelValue: string
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

const filtered = ref(true)

const remote = computed(() => {
  return Object.fromEntries(config.favorites.map(name => [name, store.market[name]]))
})

function remove(name: string) {
  const index = config.favorites.indexOf(name)
  if (index > -1) {
    config.favorites.splice(index, 1)
  }
}

</script>

<style lang="scss">

.plugin-select {
  width: 16rem;
  height: 100%;
  border-right: 1px solid var(--border);
  overflow: auto;

  .content {
    padding: 1rem 0;
    line-height: 2.25rem;
  }

  .fa-filter {
    font-size: 0.9em;
    cursor: pointer;

    &:active, &.filtered {
      opacity: 1;
    }

    &:active {
      color: var(--fg0);
    }
  }

  .readonly {
    color: var(--fg3t);

    &:hover, &.active {
      color: var(--primary);
    }

    i {
      position: absolute;
      left: 2rem;
      top: 50%;
      opacity: 0;
      color: var(--fg2);
      transform: translateY(-50%);
      transition: color 0.3s ease, opacity 0.3s ease;
    }

    i:hover {
      opacity: 1 !important;
    }
  }

  .k-tab-item:hover i {
    opacity: 0.5;
  }
}

</style>
