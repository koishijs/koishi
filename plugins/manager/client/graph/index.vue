<template>
  <draggable :width="graph.width" :height="graph.height" :padding="48">
    <div class="node-container" :class="{ active: current }">
      <div v-for="(node, id) in graph.nodes" :key="id"
        :style="getStyle(node)" :class="getClass(node)"
        @mouseenter="current = id" @mouseleave="current = null">
        <div class="content">
          <div class="title">{{ node.data.name || 'Anonymous' }}</div>
          <div>复杂度：{{ node.data.complexity }}</div>
        </div>
        <screw v-if="node.col" placement="left"></screw>
        <screw v-if="node.data.children.length" placement="right"></screw>
      </div>
    </div>
    <svg class="edge-container" :class="{ active: current }" width="1000rem" height="1000rem" viewBox="0 0 1000 1000">
      <path v-for="edge in graph.edges" :key="edge.id"
        :d="getPath(edge)" stroke-width="0.125" fill="none"></path>
    </svg>
    <svg class="edge-container highlight" width="1000rem" height="1000rem" viewBox="0 0 1000 1000">
      <path v-for="edge in graph.edges" :key="edge.id"
        :class="{ active: isActive(graph.nodes[edge.target]) }"
        :d="getPath(edge)" stroke-width="0.125" fill="none"></path>
    </svg>
  </draggable>
</template>

<script lang="ts" setup>

import { graph, getPath, getStyle, Node } from './utils'
import { ref } from 'vue'
import draggable from './draggable.vue'
import screw from './screw.vue'

const current = ref<string | number>(null)

function isActive(node: Node): boolean {
  const selected = graph.value.nodes[current.value]
  return isAncestor(selected, node) || isAncestor(node, selected)
}

function isAncestor(ancestor: Node, node: Node): boolean {
  while (node) {
    if (node === ancestor) return true
    node = node.parent
  }
}

function getClass(node: Node) {
  return {
    node: true,
    active: isActive(node),
  }
}

</script>

<style lang="scss">

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
    border: 1px solid var(--border);
    transition: background-color 0.3s ease, box-shadow 0.3s ease;

    .title {
      font-size: 1rem;
      font-weight: bolder;
      margin-bottom: 0.125rem;
    }

    .content {
      transition: opacity 0.3s ease;
    }
  }

  &.active .node:not(.active) {
    background-color: var(--page-bg);
    box-shadow: unset;

    .content {
      opacity: 0.5;
    }
  }
}

.edge-container {
  z-index: -1;
  position: absolute;

  path {
    stroke: var(--bg4);
    transition: stroke 0.3s ease;
  }

  &.active path {
    stroke: var(--border);
  }

  &.highlight {
    path {
      stroke: transparent;
    }

    path.active {
      stroke: var(--primary);
    }
  }
}

</style>
