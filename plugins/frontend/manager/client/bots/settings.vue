<template>
  <!-- <h1 class="config-header">
    配置项
    <template v-if="data.disabled">
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
    <k-schema :instant="!bot" :initial="bot?.adapter" :schema="adapterSchema" v-model="data.adapter" :disabled="!!current">
      <h3>adapter</h3>
      <p>选择要使用的适配器。</p>
    </k-schema>
    <k-schema :instant="!bot" :initial="bot?.protocol" :schema="protocolSchema" v-model="data.protocol">
      <h3>protocol</h3>
      <p>选择要使用的协议。</p>
    </k-schema>
    <k-view name="manager:bot-config" :data="data"></k-view>
  </k-form>
  <k-view name="manager:bot-epilog" :data="data"></k-view> -->
</template>

<script lang="ts" setup>

import { computed, watch, ref, reactive } from 'vue'
import { store, send, clone, Schema } from '@koishijs/client'
import { BotProvider } from '@koishijs/plugin-manager'

const props = defineProps<{
  current: string
}>()

// const createSchema = (values: string[]) => ({
//   type: 'union',
//   meta: { required: true },
//   list: values.map((value) => Schema.const(value)),
// })

// const adapterSchema = computed(() => {
//   const values = Object
//     .keys(store.protocols)
//     .map(key => key.split('.', 1)[0])
//   return createSchema(Array.from(new Set(values)))
// })

// const protocolSchema = computed(() => {
//   const prefix = data.value.adapter + '.'
//   const values = Object
//     .keys(store.protocols)
//     .filter(key => key.startsWith(prefix))
//     .map(key => key.slice(prefix.length))
//   return values.length && createSchema(values)
// })

const data = ref<Partial<BotProvider.Data>>()
const bot = computed(() => store.bots[props.current])
const initial = computed(() => {
  if (!bot.value) return {}
  if (bot.value.protocol !== data.value.protocol) return {}
  return bot.value.config
})

watch(bot, (value) => {
  if (value) {
    data.value = { ...value, config: clone(value.config) }
  } else {
    data.value = { disabled: true, config: {} }
  }
}, { immediate: true })

// watch(() => data.value.adapter, (adapter) => {
//   data.value.protocol = protocolMap[adapter]
//   data.value.config = configMap[key.value] ||= {}
// })

// watch(() => data.value.protocol, (protocol) => {
//   if (!protocol) return
//   data.value.config = configMap[key.value] ||= {}
//   protocolMap[data.value.adapter] = protocol
// }, { flush: 'post' })

// const key = computed(() => {
//   const { adapter = '', protocol } = data.value
//   const key = adapter + (protocol ? '.' + protocol : '')
//   return store.protocols[key] ? key : adapter
// })

// const protocolMap = reactive({})
// const configMap = reactive({ [key.value]: data.value.config })

function update(disabled: boolean) {
  send('manager/bot-update', props.current, data.value.adapter, {
    ...data.value.config,
    protocol: data.value.protocol,
    disabled,
  })
}

</script>

<style scoped lang="scss">

.config-header {
  font-size: 1.375rem;
  margin: 0 0 2rem;
  line-height: 2rem;

  .k-button {
    float: right;
  }
}

</style>
