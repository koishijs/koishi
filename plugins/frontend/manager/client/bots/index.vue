<template>
  <k-card-aside class="page-bots">
    <template #aside v-if="botCount || current === ''">
      <el-scrollbar>
        <div class="add k-menu-item" :class="{ active: current === '' }" @click="current = ''">添加机器人</div>
        <bot-preview
          v-for="(bot, key) in store.bots" :key="key" :data="bot"
          :class="{ active: current === key }" @click="current = key"/>
      </el-scrollbar>
    </template>
    <template v-if="current === null">
      <el-empty v-if="botCount" description="当前未选择机器人"></el-empty>
      <el-empty v-else description="当前没有配置任何机器人">
        <k-button solid @click="current = ''">添加机器人</k-button>
      </el-empty>
    </template>
    <k-content v-else class="bot-profile">
      <bot-settings :current="current" :key="current"></bot-settings>
    </k-content>
  </k-card-aside>
</template>

<script setup lang="ts">

import { ref, computed, watch } from 'vue'
import { store } from '~/client'
import BotPreview from './preview.vue'
import BotSettings from './settings.vue'

const current = ref<string | number>(null)
const botCount = computed(() => Object.keys(store.bots).length)

watch(() => store.bots, () => {
  if (current.value && !store.bots[current.value]) {
    current.value = null
  }
})

</script>

<style lang="scss">

section.page-bots {
  > aside {
    width: 20rem;
    .add {
      font-size: 1.15rem;
      text-align: center;
      padding: 1rem 0;
      font-weight: bold;
    }

    .k-menu-item {
      transition: 0.3s ease;
      border-bottom: 1px solid var(--border);
    }
  }
}

</style>
