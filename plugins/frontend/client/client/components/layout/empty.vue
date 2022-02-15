<template>
  <div class="k-empty">
    <div class="image">
      <k-icon name="koishi"></k-icon>
    </div>
    <slot></slot>
  </div>
</template>

<style lang="scss">

.k-empty {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  text-align: center;
  box-sizing: border-box;
  padding: 2rem 0;
  gap: 1.5rem;
  font-size: 14px;
  color: var(--el-text-color-secondary);

  .image {
    width: 10rem;
    color: var(--page-bg);
    transition: color 0.3s ease;

    svg {
      height: 100%;
      width: 100%;
    }
  }
}

</style>
