<template>
  <div>
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
    <div
      class="tooltip"
      :class="{ active: title }"
      :style="style"
    >{{ title }}</div>
  </div>
</template>

<script lang="ts" setup>

import { onMounted, reactive } from 'vue'
import { store } from '@koishijs/client'
import Insight from '../src'
import * as d3 from 'd3-force'
import { style, title, setTitle, deactivate } from './shared'

// const current = ref<string | number>(null)

interface Node extends Insight.Node, d3.SimulationNodeDatum {
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

onMounted(() => {
  simulation.alpha(1).restart()
})

function onClick() {}

function onMouseEnterNode(node: Node, event: MouseEvent) {
  node.active = true
  setTitle(node.name, event)
}

function onMouseLeaveNode(node: Node, event: MouseEvent) {
  node.active = false
  deactivate(300)
}

function onMouseEnterLink(link: Link, event: MouseEvent) {}

function onMouseLeaveLink(link: Link, event: MouseEvent) {}

function onDragStart(node: Node, event: MouseEvent | TouchEvent) {}

// function getEdgeClass(edge: Link) {
//   const selected = graph.value.nodes[current.value]
//   return {
//     [edge.type]: true,
//     active: isAncestor(selected, edge.source) && isAncestor(selected, edge.target)
//       || isAncestor(edge.source, selected) && isAncestor(edge.target, selected),
//   }
// }

// function getNodeClass(node: Node) {
//   const selected = graph.value.nodes[current.value]
//   return {
//     node: true,
//     active: isAncestor(selected, node) || isAncestor(node, selected),
//   }
// }

</script>

<style lang="scss" scoped>

g.nodes {
  stroke: #fff;
  stroke-opacity: 0.8;
  stroke-width: 1.5;

  circle {
    r: 10;
    fill: #9467bd;
    transition: fill 0.3s ease, r 0.3s ease;
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

g.links {
  stroke: #999;
  stroke-opacity: 0.6;
  stroke-width: 3;

  line {
    transition: stroke-width 0.3s ease;
    &:hover {
      stroke-width: 5;
    }
    &.dashed {
      stroke-dasharray: 6 6;
    }
  }
}

.tooltip {
  position: fixed;
  user-select: none;
  background-color: #0003;
  border-radius: 6px;
  padding: 4px 8px;
}

</style>
