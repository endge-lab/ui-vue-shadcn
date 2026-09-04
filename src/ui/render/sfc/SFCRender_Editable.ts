import type {
  ComponentSFCEditedEventPayload,
  ComponentSFCEventRuntimeSource,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_EventModifier,
  RComponentSFC_IR_Value,
} from '@endge/core'
import type {
  SFCVueRenderContext,
  SFCVueRenderElementInput,
  SFCVueRenderResult,
} from '@/services/render/sfc/sfc-shadcn-render.type'
import {
  matchesComponentSFCEditTrigger,
  normalizeComponentSFCEditTriggers,
} from '@endge/core'

import {
  isoDateTimeToTimeInput,
  isoToDateTimeLocalInput,
  mergeTimeIntoDateTime,
} from '@endge/utils'
import { requireSFCAdapterRenderer } from '@/ui/render/sfc/SFCRender_Adapter'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import {
  applySuffixModifiers,
  chainSFCEventAttr,
  createSFCInteractionTriggerEvent,
  ensureSFCInteractionKeyState,
  resolveSFCInteractionPlatform,
} from '@/ui/render/sfc/SFCRender_Interaction'

interface EditableOutcomeBindings {
  cancelTriggers?: RComponentSFC_IR_Value
  commitTriggers?: RComponentSFC_IR_Value
  cancelModifiers?: RComponentSFC_IR_EventModifier[]
  commitModifiers?: RComponentSFC_IR_EventModifier[]
}

const DEFAULT_CANCEL_TRIGGERS: RComponentSFC_IR_Value = {
  kind: 'literal',
  value: [{ event: 'keydown', key: ['Escape'], prevent: true, stop: true }, { event: 'focusout' }],
}
const DEFAULT_COMMIT_TRIGGERS: RComponentSFC_IR_Value = {
  kind: 'literal',
  value: [{ event: 'keydown', key: ['Enter'], prevent: true }],
}

/** Стабильный ключ host, общий для отображения, редактирования и виртуализированных renders Table. */
export function editableConsumerKey(node: RComponentSFC_IR_ElementNode, context: SFCVueRenderContext): string {
  return `${context.consumerScope}/editable:${node.id}`
}

/** Возвращает true, пока именно этот потребитель владеет единственной сессией редактирования runtime. */
export function isSFCEditableActive(node: RComponentSFC_IR_ElementNode, context: SFCVueRenderContext): boolean {
  return Boolean(node.editable && context.host?.getEditSession(editableConsumerKey(node, context)))
}

/** Добавляет listeners входа, отмены и подтверждения без замены авторских семантических handlers. */
export function attachSFCEditableAttrs(
  attrs: Record<string, unknown>,
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): void {
  if (!node.editable || !context.host) {
    return
  }
  const key = editableConsumerKey(node, context)
  const active = context.host.getEditSession(key)
  if (active) {
    attachEditableOutcomeAttrs(attrs, node, context, key, 'cancel')
    attachEditableOutcomeAttrs(attrs, node, context, key, 'commit')
    if (node.tag === 'Editable') {
      chainSFCEventAttr(attrs, 'onInput', (event: Event) => context.host?.updateEditDraft(key, readTargetValue(event, node.tag)))
    }
    return
  }

  const triggerValue = evaluateSFCValue(node.editable.triggers, context)
  const triggers = normalizeComponentSFCEditTriggers(triggerValue)
    .map(trigger => applySuffixModifiers(trigger, node.editable?.modifiers))
  if (triggers.some(trigger => trigger.held)) {
    ensureSFCInteractionKeyState()
  }
  for (const [triggerIndex, trigger] of triggers.entries()) {
    const attr = vueEventPropName(trigger.event, trigger.capture === true, trigger.passive === true)
    chainSFCEventAttr(attrs, attr, (event: Event) => {
      if (!matchesComponentSFCEditTrigger(trigger, createSFCInteractionTriggerEvent(event), resolveSFCInteractionPlatform())) {
        return
      }
      if (trigger.once && context.eventBoundary && !context.eventBoundary.claimLocalOnce(`${key}:edit:${triggerIndex}`)) {
        return
      }
      if (trigger.prevent && event.cancelable) {
        event.preventDefault()
      }
      if (trigger.stop) {
        event.stopPropagation()
      }
      const original = evaluateSFCValue(node.editable?.value, context)
      const baseVariant = String(props.variant ?? context.variant ?? 'default')
      context.host?.beginEditSession(key, original, baseVariant)
    })
  }
}

/** Отображает встроенные редакторы для трёх сокращений примитивов. */
export function renderSFCEditablePrimitive(
  input: SFCVueRenderElementInput & { props: Record<string, unknown>, attrs: Record<string, unknown> },
): SFCVueRenderResult | undefined {
  if (!input.node.editable || !['Text', 'Number', 'DateTime'].includes(input.node.tag)) {
    return undefined
  }
  const host = input.context.host
  if (!host) {
    return undefined
  }
  const key = editableConsumerKey(input.node, input.context)
  const session = host.getEditSession(key)
  if (!session) {
    return undefined
  }

  const timeOnly = input.node.tag === 'DateTime'
    && (input.props.editMode ?? input.props['edit-mode']) === 'time'
  const type = input.node.tag === 'Number'
    ? 'Number'
    : input.node.tag === 'DateTime'
      ? timeOnly ? 'Time' : 'DateTime'
      : 'String'
  const value = input.node.tag === 'DateTime'
    ? timeOnly
      ? isoDateTimeToTimeInput(session.draftValue, input.props.timezone)
      : isoToDateTimeLocalInput(session.draftValue)
    : session.draftValue ?? ''
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
    },
  })
}

function attachEditableOutcomeAttrs(
  attrs: Record<string, unknown>,
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  key: string,
  outcome: 'cancel' | 'commit',
): void {
  const editable = node.editable as typeof node.editable & EditableOutcomeBindings
  const binding = outcome === 'cancel'
    ? editable?.cancelTriggers ?? DEFAULT_CANCEL_TRIGGERS
    : editable?.commitTriggers ?? DEFAULT_COMMIT_TRIGGERS
  const suffixes = outcome === 'cancel' ? editable?.cancelModifiers : editable?.commitModifiers
  const triggers = normalizeComponentSFCEditTriggers(evaluateSFCValue(binding, context))
    .map(trigger => applySuffixModifiers(trigger, suffixes))
  if (triggers.some(trigger => trigger.held)) {
    ensureSFCInteractionKeyState()
  }
  for (const [triggerIndex, trigger] of triggers.entries()) {
    const eventName = trigger.event === 'blur' ? 'focusout' : trigger.event
    const attr = vueEventPropName(eventName, trigger.capture === true, trigger.passive === true)
    chainSFCEventAttr(attrs, attr, (event: Event) => {
      if (!matchesComponentSFCEditTrigger(trigger, createSFCInteractionTriggerEvent(event), resolveSFCInteractionPlatform())) {
        return
      }
      if (eventName === 'focusout' && focusRemainsInside(event)) {
        return
      }
      if (trigger.once && context.eventBoundary && !context.eventBoundary.claimLocalOnce(`${key}:${outcome}:${triggerIndex}`)) {
        return
      }
      if (trigger.prevent && event.cancelable) {
        event.preventDefault()
      }
      if (trigger.stop) {
        event.stopPropagation()
      }
      if (outcome === 'cancel') {
        context.host?.cancelEditSession(key)
        return
      }
      void commitEditable(node, context, readTargetValue(event, node.tag))
    })
  }
}

function focusRemainsInside(event: Event): boolean {
  const current = event.currentTarget as Node | null
  const related = (event as FocusEvent).relatedTarget as Node | null
  return Boolean(current && related && current.contains(related))
}

/** Подтверждает событие редактируемого дочернего элемента и возвращает нормализованную нагрузку для маршрутизации родителем. */
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
  const nextValue = normalizePrimitiveEditedValue(node, context, key, value)
  const payload = nextValue === undefined
    ? context.host?.commitEditSession(key)
    : context.host?.commitEditSession(key, nextValue)
  if (!payload || !context.eventBoundary) {
    return
  }
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

function normalizePrimitiveEditedValue(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  key: string,
  value: unknown,
): unknown {
  const editMode = evaluateSFCValue(node.props.editMode ?? node.props['edit-mode'], context)
  if (node.tag !== 'DateTime' || editMode !== 'time') {
    return value
  }

  const original = context.host?.getEditSession(key)?.originalValue
  const originalDate = new Date(String(original ?? '').trim())
  const base = Number.isNaN(originalDate.getTime()) ? new Date().toISOString() : original
  const timezone = evaluateSFCValue(node.props.timezone, context)
  return mergeTimeIntoDateTime(base, value, timezone) ?? value
}

function readTargetValue(event: Event, tag: string): unknown {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) {
    return undefined
  }
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
  if (!value || typeof value !== 'object') {
    return null
  }
  const focus = (value as { focus?: unknown }).focus
  return typeof focus === 'function' ? { focus: () => focus.call(value) } : null
}

function vueEventPropName(name: string, capture: boolean, passive: boolean): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}${capture ? 'Capture' : ''}${passive ? 'Passive' : ''}`
}

function isEditedPayload(value: unknown): value is ComponentSFCEditedEventPayload {
  return Boolean(value && typeof value === 'object' && Object.hasOwn(value, 'value'))
}
