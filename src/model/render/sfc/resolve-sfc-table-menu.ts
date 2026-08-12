import type { ComponentSFCTableMenuDescriptor, ContextMenuDescriptor, ContextMenuNodeDescriptor } from '@endge/core'
import type { SFCVueRenderContext } from '@/domain/types/sfc-render.type'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

export function resolveSFCTableMenu(
  descriptor: ComponentSFCTableMenuDescriptor | null,
  context: SFCVueRenderContext,
): ContextMenuDescriptor | null {
  if (!descriptor) return null
  const items: ContextMenuNodeDescriptor[] = []
  for (const node of descriptor.items) {
    if (node.kind === 'separator') {
      items.push({ ...node })
      continue
    }
    const labelValue = evaluateSFCValue(node.label, context)
    const label = labelValue == null ? '' : String(labelValue).trim()
    if (!label) continue
    items.push({
      kind: 'item',
      id: node.id,
      label,
      action: node.action,
      ...(node.input ? { input: evaluateSFCValue(node.input, context) } : {}),
      ...(node.icon ? { icon: node.icon } : {}),
    })
  }
  return { kind: 'context-menu', items }
}
