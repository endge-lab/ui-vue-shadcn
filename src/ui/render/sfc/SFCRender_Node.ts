import type { RComponentSFC_IR_ElementNode, RComponentSFC_IR_Node } from '@endge/core'
import type {
  SFCVueRenderAdapterKey,
  SFCVueRenderContext,
  SFCVueRenderFunction,
  SFCVueRenderH,
  SFCVueRenderListResult,
  SFCVueRenderResult,
} from '@/model/render/sfc/sfc-shadcn-render.type'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/model/render/sfc/sfc-shadcn-render.type'
import { registerSFCInspectionDefinitionTree, registerSFCInspectionValueNode } from '@/model/render/sfc/SFCVueRenderInspection'
import { requireSFCAdapterRenderer } from '@/ui/render/sfc/SFCRender_Adapter'
import { resolveSFCConditionState, SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { SFCRender_Component } from '@/ui/render/sfc/SFCRender_Component'
import { evaluateSFCProps, evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

const SFCRender_Variant: SFCVueRenderFunction = (input) => {
  const props = evaluateSFCProps(input.node.props, input.context)
  if (String(props.name ?? '') !== input.context.variant) {
    return null
  }
  const children = input.renderChildren(input.context)
  if (children.length === 0) {
    return null
  }
  if (children.length === 1) {
    return children[0]!
  }
  return input.h('span', { style: { display: 'contents' } }, children)
}

const SFCRender_Editable: SFCVueRenderFunction = SFCRender_Base((input) => {
  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-editable', input.props.class],
    style: { display: 'contents' },
  }, input.children)
})

const SFCRender_Structural: SFCVueRenderFunction = (input) => {
  if (input.context.inspection) {
    registerSFCInspectionDefinitionTree(input.node, input.context)
  }
  return null
}
const SFCRender_CompoundAdapter: SFCVueRenderFunction = (input) => {
  const renderFn = requireSFCAdapterRenderer(input.node.tag as SFCVueRenderAdapterKey)
  return renderFn(input)
}
const SFCRender_Adapter: SFCVueRenderFunction = SFCRender_Base((input) => {
  const renderFn = requireSFCAdapterRenderer(input.node.tag as SFCVueRenderAdapterKey)
  return renderFn(input)
})

/** Рендерит список SFC IR узлов с учетом sibling if / else-if / else chain. */
export function renderSFCNodes(
  h: SFCVueRenderH,
  nodes: RComponentSFC_IR_Node[] | undefined,
  context: SFCVueRenderContext,
): SFCVueRenderListResult {
  context.styleSiblingCount = (nodes ?? []).filter(isElementNode).length
  const result: SFCVueRenderListResult = []
  let chainActive = false
  let previousMatched = false

  for (const node of nodes ?? []) {
    if (!isElementNode(node)) {
      chainActive = false
      previousMatched = false
      appendRenderedNode(result, renderSFCNode(h, node, context))
      continue
    }

    if (node.directives.elseIf && !chainActive) {
      continue
    }
    if (node.directives.else && !chainActive) {
      continue
    }

    const condition = resolveSFCConditionState(node, context, previousMatched)

    if (condition.shouldRender) {
      appendRenderedNode(result, renderSFCElement(h, node, context))
    }

    chainActive = condition.startsChain && !condition.closesChain
    previousMatched = condition.startsChain ? condition.matchedChain : false
  }

  return result
}

/** Рендерит один SFC IR узел. */
export function renderSFCNode(
  h: SFCVueRenderH,
  node: RComponentSFC_IR_Node,
  context: SFCVueRenderContext,
): SFCVueRenderResult {
  if (node.kind === 'text') {
    if (context.inspection) {
      registerSFCInspectionValueNode(node, node.value, context)
    }
    return node.value
  }
  if (node.kind === 'expression') {
    const value = evaluateSFCValue(node.value, context)
    if (context.inspection) {
      registerSFCInspectionValueNode(node, value, context)
    }
    return value == null ? '' : String(value)
  }

  return renderSFCElement(h, node, context)
}

function renderSFCElement(
  h: SFCVueRenderH,
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
): SFCVueRenderResult {
  const renderFn = getSFCElementRenderer(node)

  return renderFn({
    h,
    node,
    context,
    children: [],
    renderChildren: childContext => renderSFCNodes(h, node.children, childContext),
    renderNodes: (nodes, childContext) => renderSFCNodes(h, nodes, childContext),
    props: {},
    attrs: {},
  })
}

function getSFCElementRenderer(
  node: RComponentSFC_IR_ElementNode,
) {
  if (node.tag === 'Table' || node.tag === 'Tooltip') {
    return SFCRender_CompoundAdapter
  }
  if (isAdapterRenderKey(node.tag)) {
    return SFCRender_Adapter
  }

  switch (node.tag) {
    case 'Component':
      return SFCRender_Component
    case 'Editable':
      return SFCRender_Editable
    case 'Variant':
      return SFCRender_Variant
    case 'TooltipTrigger':
    case 'TooltipContent':
    case 'Column':
    case 'Cell':
    case 'ColumnMenu':
    case 'RowMenu':
    case 'MenuItem':
    case 'MenuSeparator':
      return SFCRender_Structural
  }
}

function isAdapterRenderKey(tag: RComponentSFC_IR_ElementNode['tag']): tag is SFCVueRenderAdapterKey {
  return (SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS as readonly string[]).includes(tag)
}

function appendRenderedNode(
  result: SFCVueRenderListResult,
  rendered: SFCVueRenderResult,
): void {
  if (rendered === null) {
    return
  }
  result.push(rendered)
}

function isElementNode(
  node: RComponentSFC_IR_Node,
): node is RComponentSFC_IR_ElementNode {
  return node.kind === 'element'
}
