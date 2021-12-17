<template>
  <div class="chat-message" :class="{ shown }">
    <img v-if="avatar" class="avatar" :src="avatar"/>
    <div v-else class="avatar" :style="{ backgroundColor }">{{ nickname[0] }}</div>
    <div class="nickname">{{ nickname }}</div>
    <div class="message-box">
      <slot>&nbsp;</slot>
    </div>
  </div>
</template>

<script>

const colorMap = {
  Alice: '#cc0066',
  Bob: '#00994d',
  Carol: '#1e90ff',
  Dave: '#f4a460',
}

const avatarMap = {
  孤梦星影: '/avatar/satori.png',
  四季酱: '/avatar/shiki.png',
  Koishi: '/koishi.png',
}

export default {
  props: {
    nickname: String,
    color: String,
  },

  data: () => ({
    shown: false,
    active: false,
    moving: false,
  }),

  computed: {
    backgroundColor() {
      return this.color || colorMap[this.nickname]
    },

    avatar() {
      return this.nickname in avatarMap ? this.$withBase(avatarMap[this.nickname]) : ''
    },
  },

  watch: {
    active (value) {
      if (!value) return this.shown = false
      const prev = this.$el.previousElementSibling && this.$el.previousElementSibling.__vue__
      if (prev && (prev.moving || !prev.shown)) {
        prev.$once('appear', this.appear)
      } else {
        this.appear()
      }
    },
  },

  mounted () {
    this.handleScroll()
    addEventListener('scroll', this.handleScroll)
    addEventListener('resize', this.handleScroll)
  },

  beforeUnmount () {
    removeEventListener('scroll', this.handleScroll)
    removeEventListener('resize', this.handleScroll)
  },

  methods: {
    appear () {
      this.shown = true
      this.moving = true
      setTimeout(() => {
        this.moving = false
        this.$emit('appear')
      }, 100)
    },

    handleScroll () {
      const rect = this.$el.parentNode.getBoundingClientRect()
      // if (rect.top < innerHeight) this.active = true
      this.active = rect.top < innerHeight
    },
  },
}

</script>

<style lang="scss">

$avatar-size: 2.8rem;
$msgbox-left: 4.2rem;

.chat-message {
  position: relative;
  margin: 1rem 0;
  opacity: 0;
  transform: translateX(-20%);
  transition: transform 0.3s ease-out, opacity 0.3s ease;

  &.shown {
    opacity: 1;
    transform: translateX(0);
  }

  .avatar {
    width: $avatar-size;
    height: $avatar-size;
    position: absolute;
    border-radius: 100%;
    transform: translateY(-1px);
    user-select: none;
    pointer-events: none;
    text-align: center;
    line-height: $avatar-size;
    font-size: 1.6rem;
    color: white;
    font-family: "Comic Sans MS";
  }

  .nickname {
    user-select: none;
    position: relative;
    margin: 0 0 0.4rem $msgbox-left;
    font-weight: bold;
    font-size: 0.9rem;
  }
}

.message-box {
  position: relative;
  margin-left: $msgbox-left;
  width: fit-content;
  border-radius: 0.5rem;
  background-color: var(--c-bg);
  word-break: break-all;
  transition: background-color ease 0.3s;

  .chat-message:not(.no-padding) & {
    padding: 0.5rem 0.7rem;
  }

  > img {
    border-radius: 0.5rem;
  }

  img {
    vertical-align: middle;
  }

  p > img {
    margin: 0.2rem 0;
  }

  &::before {
    content: '';
    position: absolute;
    right: 100%;
    top: 0px;
    width: 12px;
    height: 12px;
    border: 0 solid transparent;
    border-bottom-width: 8px;
    border-bottom-color: currentColor;
    border-radius: 0 0 0 32px;
    color: var(--c-bg);
    transition: color ease 0.3s;
  }

  p {
    margin: 0;
  }

  blockquote {
    font-size: 0.9rem;
    margin: 0 0 0.2rem;
    background-color: #f3f6f9;
    border: none;
    border-radius: 0.5rem;
    padding: 0.2rem 0.6rem;
    background-color: var(--c-bg-light);
    color: var(--c-text-lighter);
    transition: background-color ease 0.3s, color ease 0.3s;
  }
}

</style>
