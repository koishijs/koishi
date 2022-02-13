<template>
  <k-card title="基本资料">
    <p>用户名：{{ store.user.name }}</p>
    <p>权限等级：{{ store.user.authority }}</p>
  </k-card>
  <k-card title="设置密码" v-if="secure">
    <k-input v-model="password" @enter="enter"
      :type="config.showPass ? 'text' : 'password'"
      :suffix="config.showPass ? 'eye' : 'eye-slash'"
      @click-suffix="config.showPass = !config.showPass"
    />
    <p>
      <k-button type="danger" solid :disabled="!password" @click="enter">应用更改</k-button>
    </p>
  </k-card>
</template>

<script lang="ts" setup>

import { send, store } from '~/client'
import { sha256, config } from './utils'
import { ref } from 'vue'

const secure = isSecureContext
const password = ref(config.password)

async function enter() {
  if (!password.value) return
  send('user/modify', { password: await sha256(password.value) })
  config.password = password.value
}

</script>

<style lang="scss">
</style>
