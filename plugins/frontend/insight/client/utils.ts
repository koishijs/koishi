import { PluginData } from '@koishijs/plugin-manager/src'
import { store } from '@koishijs/client'
import { Dict } from 'koishi'
import { computed } from 'vue'

export interface Node extends PluginData {
  id: string
  col?: number
  row?: number
  prev: Node[]
  next: Node[]
  visited?: boolean
  anchored?: boolean
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
      ...data,
      prev: [],
      next: [],
    }
  }

  function addEdge(type: string, source: Node, target: Node) {
    edges.push({ id: `${source.id}-${target.id}`, type, source, target })
    source.next.push(target)
    target.prev.push(source)
  }

  for (const id in nodes) {
    const node = nodes[id]
    if (typeof node.parent === 'string') {
      addEdge('invocation', nodes[node.parent], node)
    }
    for (const id of node.dependencies) {
      addEdge('dependency', nodes[id], node)
    }
  }

  const root = nodes['']
  const queue: Node[] = [root]
  const matrix: Node[][] = []
  root.col = 0
  let colMax = 0, rowMax = 0

  while (queue.length) {
    const node = queue.shift()
    const column = matrix[node.col] ||= []
    node.visited = true
    column.push(node)
    colMax = Math.max(colMax, node.col)
    rowMax = Math.max(rowMax, column.length - 1)
    for (const child of node.next) {
      if (child.col || child.prev.some(node => !node.visited)) continue
      queue.push(child)
      child.col = node.col + 1
    }
  }

  for (let index = matrix.length - 1; index >= 0; --index) {
    const column = matrix[index]
    const offset = (rowMax - column.length + 1) / 2
    column.forEach((node, index) => {
      if (!node.next.length) {
        node.row = index + offset
        return
      }
      let max = -Infinity
      let min = Infinity
      for (const child of node.next) {
        max = Math.max(max, child.row)
        min = Math.min(min, child.row)
      }
      node.anchored = true
      node.row = (max + min) / 2
    })
    column.sort((a, b) => a.row - b.row)
    console.log(column.map(node => `${node.name || 'Anonymous'} ${node.row}`).join('\n'))
    let left = 0
    while (left < column.length - 1) {
      let right = left + 1
      if (column[right].row - column[left].row >= 1) {
        left++
        continue
      }
      while (right < column.length - 1 && column[right + 1].row - column[right].row <= 1) right++
      while (left > 0 && column[left].row - column[left - 1].row <= 1) left--
      const middle = (column[left].row + column[right].row) / 2
      for (let i = left; i <= right; ++i) {
        column[i].row = middle - (left + right) / 2 + i
      }
    }
  }

  console.log(matrix)
  const width = (colMax * gridWidth + nodeWidth) * 16
  const height = (rowMax * gridHeight + nodeHeight) * 16

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
  const xMiddle = xSource + (gridWidth - nodeWidth) / 2
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
