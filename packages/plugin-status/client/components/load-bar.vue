<template>
  <div>
    <div class="load">
      <span class="type">CPU</span>
      <span class="bar">
        <span class="used" :style="{ width: (status.cpu[1] - status.cpu[0]) * 100 + '%' }"/>
        <span class="app" :style="{ width: status.cpu[0] * 100 + '%' }"/>
        &nbsp;&nbsp;{{ (status.cpu[0] * 100).toFixed(1) }}% / {{ (status.cpu[1] * 100).toFixed(1) }}%
      </span>
    </div>
    <div class="load">
      <span class="type">内存</span>
      <span class="bar">
        <span class="used" :style="{ width: (status.memory[1] - status.memory[0]) * 100 + '%' }">
          &nbsp;&nbsp;{{ (status.memory[0] * 100).toFixed(1) }}% / {{ (status.memory[1] * 100).toFixed(1) }}%
        </span>
        <span class="app" :style="{ width: status.memory[0] * 100 + '%' }"/>
      </span>
    </div>
  </div>
</template>

<script>

export default {
  props: ['status'],
}

</script>

<style lang="scss">

.load {
  margin: 1rem 0;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  user-select: none;
  .type {
    min-width: 3rem;
  }
  .bar {
    width: 100%;
    height: 1.6rem;
    position: relative;
    display: inline;
    background-color: #f6f8fa;
    line-height: 1.6;
    > * {
      height: 100%;
      position: relative;
      float: left;
      transition: 0.6s ease;
    };
    > *:hover {
      z-index: 10;
      cursor: pointer;
      box-shadow: 0 0 4px #000c;
    };
  }
  .used {
    background-color: rgb(50,197,233);
    color: white;
    &:hover {
      background-color: rgb(55,216,255);
    };
  }
  .app {
    background-color: rgb(255,159,127);
    &:hover {
      background-color: rgb(255,174,139);
    };
  }
  &:first-of-type {
    margin-top: 2rem;
  }
  &:last-of-type {
    margin-bottom: 2rem;
  }
}

</style>