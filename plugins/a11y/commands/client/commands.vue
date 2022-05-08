<template>
  <k-card class="page-commands">
    <el-tree :data="store.commands" :props="{ label: 'name' }"></el-tree>
    <template #footer>
      <p>开发中，未来会支持拖动和修改……</p>
    </template>
  </k-card>
</template>

<script lang="ts" setup>

import { store } from '@koishijs/client'

</script>
