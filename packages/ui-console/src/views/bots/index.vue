<template>
  <k-card-aside class="page-bots">
    <template #aside v-if="profile.bots.length || current === -1">
      <el-scrollbar>
        <div class="add" :class="{ active: current === -1 }" @click="current = -1">添加机器人</div>
        <div class="bots">
          <bot-view
              v-for="(bot, index) in profile.bots" :data="bot"
              :class="{ active: current === index }" @click="current = index"/>
        </div>
      </el-scrollbar>
    </template>
    <template v-if="current === null">
      <el-empty v-if="profile.bots.length" description="当前未选择机器人"></el-empty>
      <el-empty v-else description="当前没有配置任何机器人">
        <k-button solid @click="current = -1">添加机器人</k-button>
      </el-empty>
    </template>
    <k-content v-else class="bot-profile">
      <add-bot v-if="current === -1"></add-bot>
    </k-content>
  </k-card-aside>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { ElEmpty } from 'element-plus'
import { profile } from '~/client'
import AddBot from './add.vue'
import BotView from './bot.vue'

const current = ref<number>(null)

</script>

<style lang="scss">

@import '~/variables';

section.page-bots {
  > aside {
    width: 20rem;
    .add {
      font-size: 1.15rem;
      text-align: center;
      padding: 1rem 0;
      font-weight: bold;
      border-bottom: 1px solid var(--border);
      @include button-like;
    }
  }

  .el-empty {
    height: 100%;
  }
}

</style>
