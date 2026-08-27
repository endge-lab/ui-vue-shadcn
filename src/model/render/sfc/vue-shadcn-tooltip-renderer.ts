import type {
  EndgeTooltipMarkdownBlock,
  EndgeTooltipMarkdownInline,
  RComponentSFC_IR_Node,
} from '@endge/core'
import type { SFCVueRenderFunction } from '@/model/render/sfc/sfc-shadcn-render.type'
import { createEndgeTooltipDomId, parseEndgeTooltipMarkdown } from '@endge/core'

import { cloneVNode, isVNode } from 'vue'
import { attachShadcnTooltipAttrs } from '@/ui/overlay/tooltip/shadcn-tooltip-manager'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

export const VueShadcnRender_Tooltip: SFCVueRenderFunction = (input) => {
  const triggerWrapper = input.node.children.find(isTrigger)
  const contentWrapper = input.node.children.find(isContent)
  const kind = input.node.props.text ? 'text' : input.node.props.markdown ? 'markdown' : 'rich'
  const trigger = input.renderNodes(triggerWrapper?.children ?? input.node.children, input.context)
  if (!trigger.length) {
    return null
  }
  const contentNodes = contentWrapper?.children ?? []
  const boundaryId = (input.context.host?.id ?? input.context.componentStack.join('>')) || 'sfc'
  const ownerId = `${boundaryId}:${input.context.consumerScope}:${input.node.id}`
  const attrs: Record<string, unknown> = {}

  attachShadcnTooltipAttrs(attrs, input.context.tooltipManager ?? null, anchor => ({
    ownerId,
    domId: createEndgeTooltipDomId(ownerId),
    anchor,
    kind,
    policy: {
      side: evaluateProp(input, 'side') as any,
      align: evaluateProp(input, 'align') as any,
      openDelay: evaluateProp(input, 'openDelay', 'open-delay') as any,
      closeDelay: evaluateProp(input, 'closeDelay', 'close-delay') as any,
    },
    authoredId: optionalText(evaluateProp(input, 'id')),
    className: evaluateProp(input, 'class'),
    part: optionalText(evaluateProp(input, 'part')),
    renderContent: () => {
      if (kind === 'text') {
        return String(evaluateProp(input, 'text') ?? '')
      }
      if (kind === 'markdown') {
        return renderMarkdown(input, evaluateProp(input, 'markdown'))
      }
      return input.renderNodes(contentNodes, {
        ...input.context,
        styleSiblings: [],
        styleSiblingCount: contentNodes.filter(node => node.kind === 'element').length,
      })
    },
  }))

  const only = trigger.length === 1 ? trigger[0] : null
  if (only && isVNode(only)) {
    return cloneVNode(only, attrs, true)
  }
  return input.h('span', { ...attrs, class: 'endge-tooltip-trigger', style: { display: 'inline-flex', minWidth: 0 } }, trigger)
}

function renderMarkdown(input: Parameters<SFCVueRenderFunction>[0], source: unknown) {
  return parseEndgeTooltipMarkdown(source).map((block, index) => renderBlock(input, block, index))
}

function renderBlock(input: Parameters<SFCVueRenderFunction>[0], block: EndgeTooltipMarkdownBlock, key: number) {
  if (block.kind === 'heading') {
    return input.h(`h${block.level}`, { key, class: 'endge-tooltip__heading' }, inline(input, block.children))
  }
  if (block.kind === 'paragraph') {
    return input.h('p', { key, class: 'endge-tooltip__paragraph' }, inline(input, block.children))
  }
  if (block.kind === 'code-block') {
    return input.h('pre', { key, class: 'endge-tooltip__code-block' }, [input.h('code', null, block.value)])
  }
  return input.h(block.ordered ? 'ol' : 'ul', { key, class: 'endge-tooltip__list' }, block.items.map((item, index) => input.h('li', { key: index }, inline(input, item))))
}

function inline(input: Parameters<SFCVueRenderFunction>[0], nodes: EndgeTooltipMarkdownInline[]): any[] {
  return nodes.map((node, index) => {
    if (node.kind === 'text') {
      return node.value
    }
    if (node.kind === 'code') {
      return input.h('code', { key: index }, node.value)
    }
    if (node.kind === 'strong') {
      return input.h('strong', { key: index }, inline(input, node.children))
    }
    if (node.kind === 'emphasis') {
      return input.h('em', { key: index }, inline(input, node.children))
    }
    return input.h('a', { key: index, href: node.href, tabindex: -1, rel: 'noreferrer noopener' }, inline(input, node.children))
  })
}

function evaluateProp(input: Parameters<SFCVueRenderFunction>[0], ...names: string[]): unknown {
  for (const name of names) {
    const value = input.node.props[name]
    if (value) {
      return evaluateSFCValue(value, input.context)
    }
  }
  return undefined
}

function isTrigger(node: RComponentSFC_IR_Node): node is Extract<RComponentSFC_IR_Node, { kind: 'element' }> {
  return node.kind === 'element' && node.tag === 'TooltipTrigger'
}

function isContent(node: RComponentSFC_IR_Node): node is Extract<RComponentSFC_IR_Node, { kind: 'element' }> {
  return node.kind === 'element' && node.tag === 'TooltipContent'
}

function optionalText(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim()
  return normalized || undefined
}
