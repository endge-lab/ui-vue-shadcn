import type { ComponentSFCTableMenuDescriptor, ContextMenuDescriptor, ContextMenuNodeDescriptor } from '@endge/core'
import type { SFCVueRenderContext } from '@/model/render/sfc/sfc-shadcn-render.type'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

export function resolveSFCTableMenu(
  descriptor: ComponentSFCTableMenuDescriptor | null,
  context: SFCVueRenderContext,
): ContextMenuDescriptor | null {
  if (!descriptor) {
    return null
  }
  const items: ContextMenuNodeDescriptor[] = []
  for (const node of descriptor.items) {
    if (node.kind === 'separator') {
      items.push({ ...node })
      continue
    }
    if (node.visible && !evaluateSFCValue(node.visible, context)) {
      continue
    }
    const labelValue = evaluateSFCValue(node.label, context)
    const label = labelValue == null ? '' : String(labelValue).trim()
    if (!label) {
      continue
    }
    items.push({
      kind: 'item',
      id: node.id,
      label,
      action: node.requiredPort
        ? context.portBindings?.find(binding => binding.kind === 'action' && binding.port === node.requiredPort)?.identity ?? node.action
        : node.action,
      ...(node.input ? { input: evaluateSFCValue(node.input, context) } : {}),
      ...(node.icon ? { icon: node.icon } : {}),
      ...(node.disabled ? { disabled: Boolean(evaluateSFCValue(node.disabled, context)) } : {}),
    })
  }
  return { kind: 'context-menu', items: compactMenuSeparators(items) }
}

function compactMenuSeparators(items: ContextMenuNodeDescriptor[]): ContextMenuNodeDescriptor[] {
  const result: ContextMenuNodeDescriptor[] = []
  for (const item of items) {
    if (item.kind === 'separator' && (!result.length || result.at(-1)?.kind === 'separator')) {
      continue
    }
    result.push(item)
  }
  if (result.at(-1)?.kind === 'separator') {
    result.pop()
  }
  return result
}
