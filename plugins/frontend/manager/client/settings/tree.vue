<template>
  <el-scrollbar class="plugin-select" ref="root">
    <div class="search">
      <el-input v-model="keyword" #suffix>
        <k-icon name="search"></k-icon>
      </el-input>
    </div>
    <k-tab-item class="k-tab-group-title" label=":global" v-model="model">全局设置</k-tab-item>
    <el-tree
      ref="tree"
      node-key="id"
      :data="plugins.data"
      :draggable="true"
      :auto-expand-parent="false"
      :default-expanded-keys="plugins.expanded"
      :expand-on-click-node="false"
      :filter-node-method="filterNode"
      :props="{ class: getClass }"
      :allow-drag="allowDrag"
      :allow-drop="allowDrop"
      @node-click="handleClick"
      @node-drop="handleDrop"
      @node-expand="handleExpand"
      @node-collapse="handleCollapse"
      #="{ node }">
      <div class="item">
        <div class="label">{{ node.label || '待添加' }}</div>
      </div>
    </el-tree>
  </el-scrollbar>
</template>

<script lang="ts" setup>

import { ref, computed, onActivated, nextTick, watch } from 'vue'
import { send } from '@koishijs/client'
import { Tree, plugins, setPath } from './utils'

const props = defineProps<{
  modelValue: string
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

function filterNode(value: string, data: Tree) {
  return data.label.includes(keyword.value)
}

function allowDrag(node: Node) {
  return node.data.path !== ''
}

interface Node {
  data: Tree
  parent: Node
  expanded: boolean
  isLeaf: boolean
  childNodes: Node[]
}

function allowDrop(source: Node, target: Node, type: 'inner' | 'prev' | 'next') {
  return type === 'inner' ? !target.isLeaf : target.data.path !== ''
}

function handleClick(tree: Tree) {
  model.value = tree.path
}

function handleExpand(data: Tree, target: Node, instance) {
  send('manager/meta', data.path, { $collapsed: null })
}

function handleCollapse(data: Tree, target: Node, instance) {
  send('manager/meta', data.path, { $collapsed: true })
}

function handleDrop(source: Node, target: Node, position: 'before' | 'after' | 'inner', event: DragEvent) {
  const parent = position === 'inner' ? target : target.parent
  const oldPath = source.data.path
  const ctxPath = parent.data.path
  const index = parent.childNodes.findIndex(node => node.data.path === oldPath)
  send('manager/teleport', oldPath, ctxPath, index)
  const segments1 = oldPath.split('/')
  const segments2 = ctxPath ? ctxPath.split('/') : []
  segments2.push(segments1.pop())
  setPath(oldPath, segments2.join('/'))
}

function getClass(tree: Tree) {
  const words: string[] = []
  if (tree.children) words.push('is-group')
  if (tree.disabled) words.push('is-disabled')
  if (tree.path === model.value) words.push('is-active')
  return words.join(' ')
}

const root = ref<{ $el: HTMLElement }>(null)
const tree = ref(null)
const keyword = ref('')

watch(keyword, (val) => {
  tree.value.filter(val)
})

onActivated(async () => {
  const container = root.value.$el
  await nextTick()
  const element = container.querySelector('.k-tab-item.active') as HTMLElement
  if (!element) return
  root.value['setScrollTop'](element.offsetTop - (container.offsetHeight - element.offsetHeight) / 2)
})

</script>

<style lang="scss">

.plugin-select {
  width: 100%;
  height: 100%;
  border-right: 1px solid var(--border);
  overflow: auto;

  .el-scrollbar__view {
    padding: 1rem 0;
    line-height: 2.25rem;
  }

  .search {
    padding: 0 1.5rem;
  }

  .k-icon-filter {
    height: 15px;
  }

  .readonly {
    color: var(--fg3t);
  }

  .k-menu-item.active .readonly {
    color: inherit;
  }

  .k-icon.remove {
    position: absolute;
    left: 2.25rem;
    top: 50%;
    opacity: 0;
    color: var(--fg3);
    transform: translateY(-50%);
    transition: color 0.3s ease, opacity 0.3s ease;
  }

  .k-icon.remove:hover {
    opacity: 1 !important;
  }

  .k-tab-item:hover i.remove {
    opacity: 0.4;
  }

  .el-tree {
    margin-top: 0.5rem;
    user-select: none;
  }

  .el-tree-node__expand-icon {
    margin-left: 8px;
  }

  .el-tree-node.is-group {
    > .el-tree-node__content {
      font-weight: bold;
    }
  }

  .el-tree-node.is-disabled {
    > .el-tree-node__content {
      color: var(--fg3t);
    }
  }

  .el-tree-node.is-active {
    > .el-tree-node__content {
      background-color: var(--hover-bg);
      color: var(--active);
    }
  }

  .el-tree-node__content {
    line-height: 2.25rem;
    height: 2.25rem;

    .item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      overflow: hidden;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .el-tree-node__label {
    font-size: 16px;
  }
}

</style>
