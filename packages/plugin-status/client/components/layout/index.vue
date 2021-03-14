<template>
  <slot/>
</template>

<style lang="scss">

body {
  margin: 0;
  font-size: 14px;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: rgba(244, 244, 245, .6);
  overflow-x: hidden;
  background: radial-gradient(farthest-side ellipse at 10% 0, #333867, #17193b);
  background-attachment: fixed;
  background-size: cover;
  background-repeat: no-repeat;
  position: relative;
}

</style>
