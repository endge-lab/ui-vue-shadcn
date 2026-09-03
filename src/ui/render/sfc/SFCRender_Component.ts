import type { ComponentSFCProgramPayload } from '@endge/core'
import type { SFCVueRenderContext, SFCVueRenderFunction } from '@/services/render/sfc/sfc-shadcn-render.type'
import { Endge } from '@endge/core'

import { cloneVNode, isVNode } from 'vue'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { commitSFCEditableChild, editableConsumerKey } from '@/ui/render/sfc/SFCRender_Editable'
import { createSFCSemanticInteractionBindings } from '@/ui/render/sfc/SFCRender_Interaction'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

/** Рендерит вложенный SFC artifact через тот же renderer-neutral IR pipeline. */
export const SFCRender_Component: SFCVueRenderFunction = SFCRender_Base((input) => {
  const identity = String(
    (input.node.port
      ? input.context.portBindings?.find(binding => binding.port === input.node.port?.port && binding.kind === 'component')?.identity
      : null)
    ?? input.props.is
    ?? input.props.identity
    ?? '',
  ).trim()
  if (!identity) {
    return renderComponentError(input, 'component identity is empty')
  }

  if (input.context.componentStack.includes(identity)) {
    return renderComponentError(input, `component cycle: ${[...input.context.componentStack, identity].join(' -> ')}`)
  }

  const artifacts = input.context.host?.getArtifactReader() ?? Endge.program
  const artifact = artifacts.getArtifact<ComponentSFCProgramPayload>('component-sfc', identity)
  if (!artifact?.payload.ir || !artifact.capabilities.includes('renderable')) {
    return renderComponentError(input, `component:${identity}`)
  }

  const editKey = editableConsumerKey(input.node, input.context)
  const activeEdit = input.node.editable ? input.context.host?.getEditSession(editKey) : null
  const childPortBindings = input.node.portBindings ?? []
  const childBoundary = input.context.eventBoundary?.createChild(identity, artifact.payload.ir.script.ports, {
    nodeId: input.node.id,
    ref: literalString(input.node.props.ref),
    componentIdentity: identity,
    componentTag: input.node.componentTag ?? 'Component',
  }, [...(input.node.events ?? []), ...createSFCSemanticInteractionBindings(input.node, input.context)], input.node.editable
    ? (event, payload) => {
        if (event !== 'edited') {
          return { event, payload }
        }
        const committed = commitSFCEditableChild(input.node, input.context, payload)
        return committed ? { event, payload: committed } : null
      }
    : undefined, childPortBindings) ?? null
  const childContext: SFCVueRenderContext = createSFCVueRenderContext(
    createChildProps(input.props),
    input.context.renderVersion,
    input.context.host,
    artifact.payload.ir,
    [...input.context.componentStack, identity],
    `${input.context.consumerScope}/component:${input.node.id}:${identity}`,
    input.context.styleArtifacts,
    childBoundary,
    input.context.inspection,
    artifact.metadata,
    activeEdit ? 'edit' : String(input.props.variant ?? 'default'),
    input.context.tooltipManager ?? null,
    childPortBindings,
  )
  childContext.styleParent = input.context.styleParent
  childContext.inspectionParentId = input.context.inspectionParentId

  const children = renderSFCNodes(
    input.h,
    artifact.payload.ir.template.roots,
    childContext,
  )

  if (children.length === 0) {
    return null
  }
  if (input.node.editable) {
    return input.h('span', {
      ...input.attrs,
      class: ['endge-sfc-editable-component', input.props.class],
      style: { display: 'contents' },
    }, children)
  }
  if (children.length === 1) {
    const child = children[0]!
    return 'data-endge-tooltip-trigger' in input.attrs && isVNode(child)
      ? cloneVNode(child, input.attrs, true)
      : child
  }

  // RevoGrid cell templates provide a DOM hyperscript function that accepts
  // string tags, but not Vue's Symbol-based Fragment. `display: contents`
  // keeps a multi-root authored component layout-neutral in both renderers.
  return input.h('span', {
    ...('data-endge-tooltip-trigger' in input.attrs ? input.attrs : {}),
    style: 'data-endge-tooltip-trigger' in input.attrs
      ? { display: 'inline-flex', minWidth: 0 }
      : { display: 'contents' },
  }, children)
})

function createChildProps(props: Record<string, unknown>): Record<string, unknown> {
  const childProps = { ...props }
  delete childProps.is
  delete childProps.identity
  delete childProps.variant
  return childProps
}

function literalString(value: { kind: string, value?: unknown } | undefined): string | undefined {
  return value?.kind === 'literal' && typeof value.value === 'string' && value.value.trim() ? value.value.trim() : undefined
}

function renderComponentError(
  input: Parameters<SFCVueRenderFunction>[0],
  message: string,
) {
  return input.h('span', {
    ...input.attrs,
    'class': ['endge-sfc-component-placeholder', input.props.class],
    'data-component': String(input.props.is ?? input.props.identity ?? ''),
  }, message)
}
