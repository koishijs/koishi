<template>
  <k-card class="bot-table" title="账号数据">
    <div class="bots-wrapper">
      <div class="bots">
        <template v-for="(_, i) in profile.bots" :key="_.selfId">
          <bot
              v-model="profile.bots[i]"
              :class="{'sel': targetI === i}"
              @avatar-click="targetI = i"/>
        </template>
      </div>
    </div>
    <div class="profile">
      <el-empty
          v-if="targetI < 0"
          style="height: 100%"
          :description="profile.bots.length !== 0 ? '当前未选择机器人' : '当前没有配置任何机器人，点击添加'">
        <k-button v-if="profile.bots.length === 0" solid v-text="'添加机器人'"/>
      </el-empty>
      <!-- TODO 图表 -->
      <!-- TODO 操作 -->
      <!-- TODO 配置 -->
      <!-- TODO 扩展 -->
      <template v-else>
        <bot v-model="profile.bots[targetI]" size="large"/>
        <div class="echarts">
        </div>
        <div class="operate">
        </div>
        <div class="configuration">
        </div>
        <div class="extension">
        </div>
      </template>
    </div>
  </k-card>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { ElEmpty } from 'element-plus'
import { profile } from '~/client'
import Bot from '../../components/bot.vue'

const targetI = ref(-1)

</script>

<style lang="scss">
section.bot-table {
  height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;

  > div.k-card-body {
    flex-grow: 1;
    height: 0;

    display: flex;
    justify-content: space-around;

    > div.bots-wrapper {
      overflow-y: auto;
      > div.bots {
        height: 100%;
        border-right: 1px solid var(--bg2);

        > div.bot.sel {
          > div.avatar {
            transition: .1s;
            box-sizing: border-box;
            border: 5px solid var(--primary);
          }
        }
      }
    }
    > div.profile {
      flex-grow: 1;
    }
  }
}
</style>
