import { PluginData } from '@koishijs/plugin-manager/src'
import { store } from '~/client'
import { Dict } from 'koishi'
import { computed } from 'vue'

type Bound = [number, number][]

export interface Node extends PluginData {
  id: string
  col?: number
  row?: number
  bound: Bound
  prev: Node[]
  next: Node[]
  complexity: number
}

export interface Edge {
  id: string
  type: string
  source: Node
  target: Node
}

const nodeWidth = 14
const nodeHeight = 5
const gridWidth = 20
const gridHeight = 6

export const graph = computed(() => {
  const nodes: Dict<Node> = {}
  const edges: Edge[] = []

  for (const id in store.registry) {
    const data = store.registry[id]
    nodes[id] = {
      id,
      bound: [],
      prev: [],
      next: [],
      complexity: data.disposables + 1,
      ...data,
    }
  }

  for (const id in nodes) {
    const node = nodes[id]
    if (typeof node.parent === 'string') {
      addEdge('innocation', nodes[node.parent], node)
    }
  }

  function addEdge(type: string, source: Node, target: Node) {
    edges.push({ id: `${source.id}-${target.id}`, type, source, target })
    source.next.push(target)
    target.prev.push(source)
  }

  function translate(node: Node, offset: number) {
    node.row += offset
    for (const child of node.next) {
      translate(child, offset)
    }
  }

  function layout(node: Node) {
    const parent = nodes[node.parent]
    node.col = parent ? parent.col + 1 : 0

    node.next.forEach((child, index) => {
      layout(child)
      node.complexity += child.complexity

      // adjust position
      let offset = -Infinity
      for (let index = 0; index < Math.min(child.bound.length, node.bound.length); index++) {
        offset = Math.max(offset, node.bound[index][1] - child.bound[index][0])
      }
      if (offset === -Infinity) offset = 0
      if (offset > 0) {
        translate(child, offset)
        for (let index = 0; index < child.bound.length; index++) {
          child.bound[index][0] += offset
          child.bound[index][1] += offset
        }
      } else if (offset < 0) {
        while (index > 0) {
          index -= 1
          translate(node.next[index], -offset)
        }
        for (let index = 0; index < node.bound.length; index++) {
          node.bound[index][0] -= offset
          node.bound[index][1] -= offset
        }
      }
      for (let index = 0; index < child.bound.length; index++) {
        if (node.bound[index]) {
          node.bound[index][1] = child.bound[index][1]
        } else {
          node.bound.push(child.bound[index])
        }
      }
    })

    const row = node.bound.length ? (node.bound[0][0] + node.bound[0][1] - 1) / 2 : 0
    node.bound.unshift([row, row + 1])
    node.row = row
  }

  const root = nodes['']
  layout(root)
  const rowMax = root.bound.length - 1
  const colMax = Math.max(...root.bound.map(p => p[1])) - 1
  const width = (rowMax * gridWidth + nodeWidth) * 16
  const height = (colMax * gridHeight + nodeHeight) * 16

  for (const id in nodes) {
    const target = nodes[id]
    target.using.forEach((name) => {
      const id = store.services[name]
      let node = target
      while (node = nodes[node.parent]) {
        if (node.using.includes(name) || node.id === id) return
      }
      const source = nodes[id]
      if (isAncestor(source, target) || isAncestor(target, source)) return
      addEdge('service', nodes[id], target)
    })
  }

  return { nodes, edges, width, height }
})

export function isAncestor(ancestor: Node, node: Node): boolean {
  if (!node) return false
  if (node === ancestor) return true
  return node.prev.some(parent => isAncestor(ancestor, parent))
}

export function getStyle(node: Node) {
  return {
    left: `${node.col * gridWidth}rem`,
    top: `${node.row * gridHeight}rem`,
  }
}

export function getPath(edge: Edge) {
  const source = edge.source
  const target = edge.target

  const xSource = source.col * gridWidth + nodeWidth
  const xTarget = target.col * gridWidth
  const xMiddle = (xSource + xTarget) / 2
  const ySource = source.row * gridHeight + nodeHeight / 2
  const yTarget = target.row * gridHeight + nodeHeight / 2
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
