import type {
  ComponentSFCEventRuntimeSource,
  ComponentSFCEditedEventPayload,
  RComponentSFC_IR_ElementNode,
} from '@endge/core'
import {
  matchesComponentSFCEditTrigger,
  normalizeComponentSFCEditTriggers,
} from '@endge/core'
import { isoToDateTimeLocalInput } from '@endge/utils'

import type {
  SFCVueRenderContext,
  SFCVueRenderElementInput,
  SFCVueRenderResult,
} from '@/domain/types/sfc-render.type'
import { requireSFCAdapterRenderer } from '@/ui/render/sfc/SFCRender_Adapter'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import {
  applySuffixModifiers,
  chainSFCEventAttr,
  createSFCInteractionTriggerEvent,
  ensureSFCInteractionKeyState,
  resolveSFCInteractionPlatform,
} from '@/ui/render/sfc/SFCRender_Interaction'

/** Stable host-owned key shared by display, edit and virtualized Table renders. */
export function editableConsumerKey(node: RComponentSFC_IR_ElementNode, context: SFCVueRenderContext): string {
  return `${context.consumerScope}/editable:${node.id}`
}

/** Returns true while this exact consumer owns the runtime's single edit session. */
export function isSFCEditableActive(node: RComponentSFC_IR_ElementNode, context: SFCVueRenderContext): boolean {
  return Boolean(node.editable && context.host?.getEditSession(editableConsumerKey(node, context)))
}

/** Adds entry/cancel/commit listeners without replacing authored semantic handlers. */
export function attachSFCEditableAttrs(
  attrs: Record<string, unknown>,
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): void {
  if (!node.editable || !context.host) return
  const key = editableConsumerKey(node, context)
  const active = context.host.getEditSession(key)
  if (active) {
    chainSFCEventAttr(attrs, 'onKeydown', (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      context.host?.cancelEditSession(key)
    })
    if (node.tag === 'Editable') {
      chainSFCEventAttr(attrs, 'onInput', (event: Event) => context.host?.updateEditDraft(key, readTargetValue(event, node.tag)))
      chainSFCEventAttr(attrs, 'onChange', (event: Event) => void commitEditable(node, context, readTargetValue(event, node.tag)))
    }
    return
  }

  const triggerValue = evaluateSFCValue(node.editable.triggers, context)
  const triggers = normalizeComponentSFCEditTriggers(triggerValue)
    .map(trigger => applySuffixModifiers(trigger, node.editable?.modifiers))
  if (triggers.some(trigger => trigger.held)) ensureSFCInteractionKeyState()
  for (const [triggerIndex, trigger] of triggers.entries()) {
    const attr = vueEventPropName(trigger.event, trigger.capture === true, trigger.passive === true)
    chainSFCEventAttr(attrs, attr, (event: Event) => {
      if (!matchesComponentSFCEditTrigger(trigger, createSFCInteractionTriggerEvent(event), resolveSFCInteractionPlatform())) return
      if (trigger.once && context.eventBoundary && !context.eventBoundary.claimLocalOnce(`${key}:edit:${triggerIndex}`)) return
      if (trigger.prevent && event.cancelable) event.preventDefault()
      if (trigger.stop) event.stopPropagation()
      const original = evaluateSFCValue(node.editable?.value, context)
      const baseVariant = String(props.variant ?? context.variant ?? 'default')
      context.host?.beginEditSession(key, original, baseVariant)
    })
  }
}

/** Renders built-in editors for the three primitive shortcuts. */
export function renderSFCEditablePrimitive(
  input: SFCVueRenderElementInput & { props: Record<string, unknown>, attrs: Record<string, unknown> },
): SFCVueRenderResult | undefined {
  if (!input.node.editable || !['Text', 'Number', 'DateTime'].includes(input.node.tag)) return undefined
  const host = input.context.host
  if (!host) return undefined
  const key = editableConsumerKey(input.node, input.context)
  const session = host.getEditSession(key)
  if (!session) return undefined

  const type = input.node.tag === 'Number'
    ? 'Number'
    : input.node.tag === 'DateTime'
      ? 'DateTime'
      : 'String'
  const value = input.node.tag === 'DateTime'
    ? isoToDateTimeLocalInput(session.draftValue)
    : session.draftValue == null ? '' : session.draftValue
  const attrs = { ...input.attrs }
  delete attrs.onClick
  delete attrs.onDblclick
  delete attrs.onFocus

  const renderInput = requireSFCAdapterRenderer('Input')
  return renderInput({
    ...input,
    children: [],
    props: {
      ...input.props,
      class: ['endge-sfc-editable-input', input.props.class],
      type,
      value,
    },
    attrs: {
      ...attrs,
      autofocus: true,
      ref: ((element: unknown) => focusSFCEditableControl(element)) as any,
      onInput: (event: Event) => host.updateEditDraft(key, readTargetValue(event, input.node.tag)),
      onChange: (event: Event) => void commitEditable(input.node, input.context, readTargetValue(event, input.node.tag)),
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          host.cancelEditSession(key)
        }
        else if (event.key === 'Enter') {
          event.preventDefault()
          void commitEditable(input.node, input.context, readTargetValue(event, input.node.tag))
        }
      },
    },
  })
}

/** Commits an editable child event and returns the normalized payload for parent routing. */
export function commitSFCEditableChild(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  payload: unknown,
): ComponentSFCEditedEventPayload | null {
  const key = editableConsumerKey(node, context)
  const value = isEditedPayload(payload) ? payload.value : payload
  return context.host?.commitEditSession(key, value) ?? null
}

async function commitEditable(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  value: unknown,
): Promise<void> {
  const key = editableConsumerKey(node, context)
  const payload = context.host?.commitEditSession(key, value)
  if (!payload || !context.eventBoundary) return
  const source: ComponentSFCEventRuntimeSource = {
    nodeId: node.id,
    componentTag: node.componentTag ?? node.tag,
  }
  await context.eventBoundary.routeChild(
    source,
    'edited',
    payload,
    node.events ?? [],
    [],
    0,
    { ...context.props, ...context.locals },
  )
}

function readTargetValue(event: Event, tag: string): unknown {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) return undefined
  if (tag === 'Number') {
    const value = Number(target.value)
    return target.value === '' || !Number.isFinite(value) ? null : value
  }
  return target.value
}

function focusSFCEditableControl(target: unknown): void {
  const component = target as { $el?: unknown } | null
  const root = component?.$el ?? target
  const focusableRoot = asFocusable(root)
  if (focusableRoot) {
    focusableRoot.focus()
    return
  }

  const container = root as { querySelector?: (selector: string) => unknown } | null
  const control = container?.querySelector?.('input, textarea, select, button, [tabindex]:not([tabindex="-1"])')
  asFocusable(control)?.focus()
}

function asFocusable(value: unknown): { focus: () => void } | null {
  if (!value || typeof value !== 'object') return null
  const focus = (value as { focus?: unknown }).focus
  return typeof focus === 'function' ? { focus: () => focus.call(value) } : null
}

function vueEventPropName(name: string, capture: boolean, passive: boolean): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}${capture ? 'Capture' : ''}${passive ? 'Passive' : ''}`
}

function isEditedPayload(value: unknown): value is ComponentSFCEditedEventPayload {
  return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value'))
}
