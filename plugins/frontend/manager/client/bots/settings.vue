<template>
  <h1 class="config-header">
    配置项
    <template v-if="data.config.disabled">
      <k-button solid @click="update(false)">登录账号</k-button>
      <k-button solid v-if="current" type="error" @click="send('manager/bot-remove', current)">移除实例</k-button>
    </template>
    <template v-else>
      <k-button solid @click="update(true)">退出账号</k-button>
      <k-button solid type="error" @click="send('manager/bot-remove', current)">移除实例</k-button>
    </template>
  </h1>
  <k-view name="manager:bot-prolog" :data="data"></k-view>
  <k-form :schema="store.protocols[key]" :initial="initial" v-model="data.config" :show-header="true" #prolog>
    <k-schema :initial="(bot ?? data).adapter" :schema="adapterSchema" v-model="data.adapter" :disabled="!!current">
      <h3 class="required">adapter</h3>
      <p>选择要使用的适配器。</p>
    </k-schema>
    <k-schema :initial="(bot ?? data).config.protocol" :schema="protocolSchema" v-model="data.config.protocol">
      <h3 class="required">protocol</h3>
      <p>选择要使用的协议。</p>
    </k-schema>
    <k-view name="manager:bot-config" :data="data"></k-view>
  </k-form>
  <k-view name="manager:bot-epilog" :data="data"></k-view>
</template>

<script lang="ts" setup>

import { computed, watch, ref, reactive } from 'vue'
import { store, send, clone } from '@koishijs/client'
import { BotProvider } from '@koishijs/plugin-manager'

const props = defineProps<{
  current: string
}>()

const createSchema = (values: string[]) => ({
  type: 'union',
  meta: {},
  list: values.map((value) => ({
    type: 'const',
    value,
    meta: {},
  })),
})

const adapterSchema = computed(() => {
  const values = Object
    .keys(store.protocols)
    .map(key => key.split('.', 1)[0])
  return createSchema(Array.from(new Set(values)))
})

const protocolSchema = computed(() => {
  const prefix = data.value.adapter + '.'
  const values = Object
    .keys(store.protocols)
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length))
  return values.length && createSchema(values)
})

const data = ref<Partial<BotProvider.Data>>()
const bot = computed(() => store.bots[props.current])
const initial = computed(() => {
  if (!bot.value) return
  const { protocol } = bot.value.config
  if (protocol !== data.value.config.protocol) return
  return bot.value.config
})

watch(bot, (value) => {
  data.value = {
    adapter: '',
    ...value,
    config: value ? clone(value.config) : { disabled: true },
  }
}, { immediate: true })

watch(() => data.value.adapter, () => {
  dict[key.value] = data.value.config = { ...dict[key.value], protocol: '', disabled: true }
})

watch(() => data.value.config.protocol, (protocol) => {
  if (!protocol) return
  const { disabled } = data.value.config
  dict[key.value] = data.value.config = { ...dict[key.value], protocol, disabled }
}, { flush: 'post' })

const key = computed(() => {
  const { adapter, config } = data.value
  const key = adapter + (config.protocol ? '.' + config.protocol : '')
  return store.protocols[key] ? key : adapter
})

const dict = reactive({ [key.value]: data.value.config })

function update(disabled: boolean) {
  send('manager/bot-update', props.current, data.value.adapter, {
    ...data.value.config,
    disabled,
  })
}

</script>

<style scoped lang="scss">

</style>
