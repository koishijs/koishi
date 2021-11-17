<template>
  <div class="dependencies" ref="container">
    <div class="container" ref="root" :style="style">
      <div class="node-container">
        <div class="node" v-for="node in graph.nodes" :style="getStyle(node)">
          <div class="title">{{ node.data.name || 'Anonymous' }}</div>
          <div>复杂度：{{ node.data.complexity }}</div>
          <screw v-if="node.x" placement="left"></screw>
          <screw v-if="node.data.children.length" placement="right"></screw>
        </div>
      </div>
      <svg class="edge-container" width="1000rem" height="1000rem" viewBox="0 0 1000 1000">
        <path v-for="edge in graph.edges" :d="getPath(edge)" stroke-width="0.125" fill="none"></path>
      </svg>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { PluginData } from '@koishijs/plugin-manager/src'
import { store } from '~/client'
import { ref, computed } from 'vue'
import { useDraggable } from './utils'
import { Dict } from 'koishi'
import screw from './screw.vue'

const root = ref<HTMLElement>(null)
const container = ref<HTMLElement>(null)

const { position } = useDraggable(root, {
  container,
  padding: 48,
})

interface Node {
  x: number
  y: number
  data: PluginData
}

interface Edge {
  source: string
  target: string
}

const graph = computed(() => {
  const nodes: Dict<Node> = {}
  const edges: Edge[] = []
  let xMax = 0, yMax = 0

  function traverse(data: PluginData, x: number, y: number): number {
    const yInit = y
    nodes[data.id] = { x, y, data }
    xMax = Math.max(xMax, x)
    yMax = Math.max(yMax, y)

    data.children.forEach((child) => {
      y = traverse(child, x + 1, y) + 1
      edges.push({
        source: data.id,
        target: child.id,
      })
    })

    if (data.children.length) {
      y -= 1
      nodes[data.id].y = (y + yInit) / 2
    }

    return y
  }

  traverse(store.registry, 0, 0)

  return { nodes, edges, xMax, yMax }
})

const style = computed(() => ({
  left: position.x + 'px',
  top: position.y + 'px',
  width: graph.value.xMax * gridWidth + nodeWidth + 'rem',
  height: graph.value.yMax * gridHeight + nodeHeight + 'rem',
}))

function getStyle(node: Node) {
  return {
    left: `${node.x * gridWidth}rem`,
    top: `${node.y * gridHeight}rem`,
  }
}

const nodeWidth = 14
const nodeHeight = 5
const gridWidth = 20
const gridHeight = 6

function getPath(edge: Edge) {
  const source = graph.value.nodes[edge.source]
  const target = graph.value.nodes[edge.target]

  const xSource = source.x * gridWidth + nodeWidth
  const xTarget = target.x * gridWidth
  const xMiddle = (xSource + xTarget) / 2
  const ySource = source.y * gridHeight + nodeHeight / 2
  const yTarget = target.y * gridHeight + nodeHeight / 2
  if (ySource === yTarget) {
    return `M ${xSource} ${ySource} H ${xTarget}`
  }

  const sign = Math.sign(yTarget - ySource)
  const x1 = xMiddle - 2
  const x2 = xMiddle
  const x3 = xMiddle
  const x4 = xMiddle + 2
  const y1 = ySource
  const y2 = ySource + 1.75 * sign
  const y3 = yTarget - 1.75 * sign
  const y4 = yTarget

  const curve1 = `${x2} ${ySource} ${xMiddle} ${y1} ${xMiddle} ${y2}`
  const curve2 = `${xMiddle} ${y4} ${x3} ${yTarget} ${x4} ${yTarget}`
  return `M ${xSource} ${ySource} H ${x1} C ${curve1} V ${y3} C ${curve2} H ${xTarget}`
}

</script>

<style lang="scss">

.dependencies {
  position: fixed;
  left: var(--aside-width);
  right: 0;
  top: 0;
  bottom: 0;
}

.dependencies .container {
  position: fixed;
  user-select: none;
  overflow: hidden;
}

.node-container {
  .node {
    font-size: 0.875rem;
    position: absolute;
    padding: 1rem;
    width: 12rem;
    height: 3rem;
    line-height: 1.5;
    border-radius: 8px;
    background-color: var(--card-bg);
    box-shadow: var(--card-shadow);
    transition: background-color 0.3s ease, box-shadow 0.3s ease;

    .title {
      font-size: 1rem;
      font-weight: bolder;
      margin-bottom: 0.125rem;
    }
  }
}

.edge-container {
  path {
    stroke: var(--bg4);
    transition: stroke 0.3s ease;
  }
}

</style>
