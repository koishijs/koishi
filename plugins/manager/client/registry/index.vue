<template>
  <div class="container" :style="{ width: graph.width, height: graph.height }">
    <div class="node-container">
      <div class="node" v-for="node in graph.nodes" :style="getStyle(node)">
        {{ node.data.name || 'Anonymous' }}
      </div>
    </div>
    <svg class="edge-container" width="1000rem" height="1000rem" viewBox="0 0 1000 1000">
      <path v-for="edge in graph.edges" :d="getPath(edge)" stroke="black" stroke-width="0.125" fill="none"></path>
    </svg>
  </div>
</template>

<script lang="ts" setup>

import { PluginData } from '@koishijs/plugin-manager/src'
import { store } from '~/client'
import { computed } from 'vue'
import { Dict } from 'koishi'

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
  let maxX = 0, maxY = 0

  function traverse(data: PluginData, x: number, y: number): number {
    nodes[data.id] = { x, y, data }
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)

    data.children.forEach((child) => {
      y = traverse(child, x + 1, y) + 1
      edges.push({
        source: data.id,
        target: child.id,
      })
    })

    if (data.children.length) y -= 1
    return y
  }

  traverse(store.registry, 0, 0)

  const width = maxX * 20 + 18 + 'rem'
  const height = maxY * 6 + 6 + 'rem'

  return { nodes, edges, width, height }
})

function getStyle(node: Node) {
  return {
    left: `${node.x * 20}rem`,
    top: `${node.y * 6}rem`,
  }
}

function getPath(edge: Edge) {
  const source = graph.value.nodes[edge.source]
  const target = graph.value.nodes[edge.target]

  const xSource = source.x * 20 + 14
  const xTarget = target.x * 20
  const xMiddle = (xSource + xTarget) / 2
  const ySource = source.y * 6 + 1.75
  const yTarget = target.y * 6 + 1.75
  if (ySource === yTarget) {
    return `M ${xSource} ${ySource} H ${xTarget}`
  }

  const x1 = xMiddle - 2
  const x2 = xMiddle
  const x3 = xMiddle
  const x4 = xMiddle + 2
  const y1 = ySource
  const y2 = ySource + 1.75
  const y3 = yTarget - 1.75
  const y4 = yTarget

  const curve1 = `${x2} ${ySource} ${xMiddle} ${y1} ${xMiddle} ${y2}`
  const curve2 = `${xMiddle} ${y4} ${x3} ${yTarget} ${x4} ${yTarget}`
  return `M ${xSource} ${ySource} H ${x1} C ${curve1} V ${y3} C ${curve2} H ${xTarget}`
}

</script>

<style lang="scss">

.container {
  position: relative;
  z-index: -1;
  overflow: hidden;
}

.node {
  position: absolute;
  padding: 1rem;
  width: 12rem;
  line-height: 1.5;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--card-bg);
  box-shadow: var(--card-shadow);
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

</style>
