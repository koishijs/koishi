<template>
  <k-card title="基本资料">
    <p>用户名：{{ user.name }}</p>
    <p>权限等级：{{ user.authority }}</p>
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

import { user, config, send, sha256 } from '~/client'
import { ref } from 'vue'

const secure = isSecureContext
const password = ref(config.value.password)

async function enter() {
  if (!password.value) return
  const { id, token } = user.value
  send('password', { id, token, password: await sha256(password.value) })
  config.value.password = password.value
}

</script>

<style lang="scss">
</style>
