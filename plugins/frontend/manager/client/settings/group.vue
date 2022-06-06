<template>
  <h1 class="config-header">
    {{ data.label }}
  </h1>
</template>

<script lang="ts" setup>

import { send, store, clone } from '@koishijs/client'
import { ref, watch } from 'vue'
import { Tree } from './utils'

const props = defineProps<{
  data: Tree
}>()

</script>
