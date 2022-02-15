<template>
  <k-card class="profile-basic">
    <h1>
      基本资料
      <k-button class="float-right" solid type="error" @click="logout">退出登录</k-button>
      <k-button class="float-right" solid :disabled="!Object.keys(diff).length" @click="update">应用更改</k-button>
    </h1>
    <k-form :schema="schema" v-model="diff" :show-header="false"></k-form>
  </k-card>
</template>

<script lang="ts" setup>

import { send, store } from '@koishijs/client'
import { sha256, config } from './utils'
import { computed, ref } from 'vue'
import { message, Schema } from '@koishijs/client'
import { UserUpdate } from '@koishijs/plugin-auth'

const diff = ref<UserUpdate>({})

const schema = computed(() => {
  const result: Schema<UserUpdate> = Schema.object({
    name: Schema.string().description('用户名').default(config.name),
  })
  if (isSecureContext) {
    result.dict.password = Schema.string().role('secret').description('密码').default(config.password)
  }
  return result
})

async function logout() {
  delete config.id
  delete config.token
  delete config.expire
  return send('user/logout')
}

async function update() {
  const update: UserUpdate = { ...diff.value }
  if (update.password) {
    update.password = await sha256(update.password)
  }
  try {
    await send('user/update', update)
    message.success('修改成功！')
    Object.assign(config, diff)
    Object.assign(store.user, update)
    diff.value = {}
  } catch (e) {
    message.error(e.message)
  }
}

</script>

<style lang="scss">

.profile-basic {
  max-width: 50rem;
  margin: 2rem auto;

  h1 {
    font-size: 1.375rem;
    margin: 1.5rem 0;
    line-height: 2rem;
  }
}

</style>
