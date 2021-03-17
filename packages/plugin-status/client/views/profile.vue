<template>
  <k-card title="基本资料">
    <p>用户名：{{ user.name }}</p>
    <p>权限等级：{{ user.authority }}</p>
  </k-card>
  <k-card title="设置密码">
    <k-input v-model="password" @enter="enter"
      :type="hidden ? 'password' : 'text'"
      :suffix="hidden ? 'eye-slash' : 'eye'"
      @click-suffix="hidden = !hidden"
    />
    <p>
      <k-button type="danger" solid :disabled="!password" @click="enter">应用更改</k-button>
    </p>
  </k-card>
</template>

<script lang="ts" setup>

import { user, config, send, sha256 } from '~/client'
import { ref } from 'vue'

const hidden = ref(true)
const password = ref(config.value.password)

async function enter() {
  if (!password.value) return
  const { id } = user.value
  send('password', { id, password: await sha256(password.value) })
  config.value.password = password.value
}

</script>

<style lang="scss">
</style>
