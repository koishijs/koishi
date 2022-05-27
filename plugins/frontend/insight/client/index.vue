<template>
  <div :class="{ highlight }">
    <svg
      ref="svg"
      id="couple"
      :width="size"
      :height="size"
      :viewBox="`-${size / 2} -${size / 2} ${size} ${size}`"
      @click.stop.prevent="onClick"
    >
      <g class="links">
        <line
          v-for="(link, index) in links"
          :key="index"
          :x1="link.source.x"
          :y1="link.source.y"
          :x2="link.target.x"
          :y2="link.target.y"
          :class="link.type"
          @mouseenter.stop.prevent="onMouseEnterLink(link, $event)"
          @mouseleave.stop.prevent="onMouseLeaveLink(link, $event)"
        />
      </g>
      <g class="nodes">
        <circle
          v-for="(node, index) in nodes"
          :key="index"
          :cx="node.x"
          :cy="node.y"
          :class="{ active: node.active }"
          @mouseenter.stop.prevent="onMouseEnterNode(node, $event)"
          @mouseleave.stop.prevent="onMouseLeaveNode(node, $event)"
          @mousedown.stop.prevent="onDragStart(node, $event)"
          @touchstart.stop.prevent="onDragStart(node, $event)"
        />
      </g>
    </svg>
    <transition name="fade">
      <div class="tooltip" v-show="tooltip.active" :style="tooltip.style">{{ tooltip.title }}</div>
    </transition>
  </div>
</template>

<script lang="ts" setup>

import { onMounted, reactive, ref } from 'vue'
import { store } from '@koishijs/client'
import Insight from '../src'
import * as d3 from 'd3-force'
import { useTooltip, getEventPoint } from './tooltip'
import { useEventListener } from '@vueuse/core'

const tooltip = useTooltip()

// const current = ref<string | number>(null)
const dragged = ref<Node>(null)
const highlight = ref(false)

interface Node extends Insight.Node, d3.SimulationNodeDatum {
  lastX?: number
  lastY?: number
  active?: boolean
}

interface Link extends Omit<Insight.Link, 'source' | 'target'>, d3.SimulationLinkDatum<Node> {
  source: Node
  target: Node
}

const nodes = reactive<Node[]>(store.insight.nodes as any)
const links = reactive<Link[]>(store.insight.edges as any)

const size = 960

const forceLink = d3
  .forceLink<Node, Link>(links)
  .id(node => node.id)
  .distance(120)

const simulation = d3
  .forceSimulation(nodes)
  .force('link', forceLink)
  .force('charge', d3.forceManyBody().strength(-400))
  .force('x', d3.forceX().strength(0.05))
  .force('y', d3.forceY().strength(0.05))
  .stop()

const ticks = 1000
const alphaMin = 0.001

onMounted(() => {
  simulation
    .alpha(1)
    .alphaMin(alphaMin)
    .alphaDecay(1 - Math.pow(alphaMin, 1 / ticks))
    .restart()
})

useEventListener('mousemove', onDragMove)
useEventListener('touchmove', onDragMove)
useEventListener('mouseup', onDragEnd)
useEventListener('touchend', onDragEnd)

function onClick() {
  setFocusedNodes()
  tooltip.deactivate(0)
}

function onMouseEnterNode(node: Node, event: MouseEvent) {
  node.active = true
  tooltip.activate(node.name, event)
}

function onMouseLeaveNode(node: Node, event: MouseEvent) {
  if (dragged.value === node) return
  node.active = false
  tooltip.deactivate(300)
}

function onMouseEnterLink(link: Link, event: MouseEvent) {}

function onMouseLeaveLink(link: Link, event: MouseEvent) {}

function onDragStart(node: Node, event: MouseEvent | TouchEvent) {
  dragged.value = node
  node.active = true
  simulation.alphaTarget(0.3).restart()
  const point = getEventPoint(event)
  node.lastX = point.clientX
  node.lastY = point.clientY
  node.fx = node.x
  node.fy = node.y
}

function onDragMove(event: MouseEvent | TouchEvent) {
  const node = dragged.value
  if (!node) return
  const point = getEventPoint(event)
  node.fx += point.clientX - node.lastX
  node.fy += point.clientY - node.lastY
  node.lastX = point.clientX
  node.lastY = point.clientY
  // const dist2 = node.fx ** 2 + node.fy ** 2
  // if (dist2 > this.DRAGGABLE_RADIUS ** 2) {
  //   const scale = this.DRAGGABLE_RADIUS / Math.sqrt(dist2)
  //   node.fx *= scale
  //   node.fy *= scale
  // }
}

function onDragEnd(event: MouseEvent | TouchEvent) {
  simulation.alphaTarget(0)
  const node = dragged.value
  if (!node) return
  node.fx = null
  node.fy = null
  node.active = false
  dragged.value = null
}

function setFocusedNodes(...nodes: Node[]) {
  // this.nodes.forEach((node) => {
  //   node.focused = !!nodes.find(({ id }) => id === node.id)
  // })
}

</script>

<style lang="scss" scoped>

g.nodes {
  stroke: var(--border);
  stroke-opacity: 0.8;
  stroke-width: 1.5;

  circle {
    r: 10;
    cursor: pointer;
    fill: var(--card-bg);
    transition: 0.3s ease;
    &.active, &:hover {
      r: 12;
      fill: #17becf;
    }
  }

  text {
    font-weight: 200;
    letter-spacing: 1px;
  }
}

.highlight g.nodes {
  circle {
    fill: var(--page-bg);
  }
}

g.links {
  stroke: var(--bg4);
  stroke-opacity: 0.6;
  stroke-width: 3;

  line {
    transition: 0.3s ease;
    &:hover {
      stroke-width: 5;
    }
    &.dashed {
      stroke-dasharray: 6 6;
    }
  }

  &.active path {
    stroke: var(--border);
  }
}

.highlight g.links {
  path.active {
    stroke: var(--primary);
  }
}

.tooltip {
  position: fixed;
  pointer-events: none;
  background-color: #0003;
  border-radius: 6px;
  padding: 4px 8px;
  transition: 0.3s ease;

  &.fade-enter-from, &.fade-leave-to {
    opacity: 0;
  }
}

</style>
