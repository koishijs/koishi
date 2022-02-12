<template>
  <el-scrollbar class="plugin-select" ref="root">
    <div class="content">
      <div class="search">
        <el-input v-model="keyword" #suffix>
          <k-icon name="search"></k-icon>
        </el-input>
      </div>
      <k-tab-item class="k-tab-group-title" label="" v-model="model">
        全局设置
      </k-tab-item>
      <div class="k-tab-group-title">
        运行中的插件
      </div>
      <k-tab-group
        :data="packages" v-model="model"
        :filter="data => data.id" #="data">
        <span :class="{ readonly: isReadonly(data) }">{{ data.shortname }}</span>
      </k-tab-group>
      <div class="k-tab-group-title">
        未运行的插件
        <k-hint placement="right" name="filter" v-model="filtered">
          <template v-if="filtered">
            <b>筛选：已开启</b><br>只显示可在线配置的插件。
          </template>
          <template v-else>
            <b>筛选：已关闭</b><br>显示所有已安装的插件。
          </template>
        </k-hint>
      </div>
      <k-tab-group
        :data="packages" v-model="model"
        :filter="data => !data.id && data.name && (!filtered || !isReadonly(data))" #="data">
        <span :class="{ readonly: isReadonly(data) }">{{ data.shortname }}</span>
      </k-tab-group>
    </div>
  </el-scrollbar>
</template>

<script lang="ts" setup>

import { ref, computed, onActivated, nextTick } from 'vue'
import { store } from '~/client'

const props = defineProps<{
  modelValue: string
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

const packages = computed(() => {
  return Object.fromEntries(Object.values(store.packages)
    .filter(data => data.shortname.includes(keyword.value))
    .sort((a, b) => a.shortname < b.shortname ? -1 : 1)
    .map(data => [data.name, data]))
})

const root = ref<{ $el: HTMLElement }>(null)
const filtered = ref(false)
const keyword = ref('')

function isReadonly(data: any) {
  return !data.root && data.id
}

onActivated(async () => {
  const container = root.value.$el
  await nextTick()
  const element = container.querySelector('.k-tab-item.active') as HTMLElement
  root.value['setScrollTop'](element.offsetTop - (container.offsetHeight - element.offsetHeight) / 2)
})

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

  .search {
    padding: 0 1.5rem;
  }

  .k-icon-filter {
    height: 15px;
  }

  .readonly {
    color: var(--fg3t);
  }

  .k-menu-item.active .readonly {
    color: inherit;
  }

  .k-icon.remove {
    position: absolute;
    left: 2.25rem;
    top: 50%;
    opacity: 0;
    color: var(--fg3);
    transform: translateY(-50%);
    transition: color 0.3s ease, opacity 0.3s ease;
  }

  .k-icon.remove:hover {
    opacity: 1 !important;
  }

  .k-tab-item:hover i.remove {
    opacity: 0.4;
  }
}

</style>
