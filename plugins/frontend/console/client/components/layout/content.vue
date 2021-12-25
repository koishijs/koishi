<template>
  <el-scrollbar>
    <div class="k-content">
      <slot></slot>
    </div>
  </el-scrollbar>
</template>

<style lang="scss" scoped>

.k-content {
  margin: auto;
  max-width: 50rem;
  padding: 3rem 3rem 1rem;
}

</style>
