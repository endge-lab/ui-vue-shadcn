import type {
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
  RComponentSFC_IR_Value,
  SFCRenderInspectionBinding,
} from '@endge/core'
import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-shadcn-render.type'

/** Регистрирует пользовательскую границу компонента, владеющую текущими корнями IR. */
export function registerSFCInspectionRoot(context: SFCVueRenderContext): string | null {
  if (!context.inspection) {
    return null
  }
  const componentIdentity = getComponentIdentity(context)
  return context.inspection.registerNode({
    runtimeId: getRuntimeId(context),
    componentIdentity,
    componentStack: [...context.componentStack],
    scope: context.consumerScope,
    parentId: context.inspectionParentId ?? null,
    nodeId: '$component',
    kind: 'component',
    tag: componentIdentity,
    componentTag: componentIdentity,
    props: context.props,
    componentProps: context.props,
    locals: context.locals,
    bindings: {},
  })
}

/** Регистрирует один вычисленный экземпляр элемента IR и возвращает его нейтральный к DOM id. */
export function registerSFCInspectionElement(
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): string | null {
  if (!context.inspection) {
    return null
  }
  const calledComponentIdentity = node.tag === 'Component'
    ? String(props.is ?? props.identity ?? '').trim() || undefined
    : undefined
  return context.inspection.registerNode({
    runtimeId: getRuntimeId(context),
    componentIdentity: getComponentIdentity(context),
    componentStack: [...context.componentStack],
    scope: context.consumerScope,
    parentId: context.inspectionParentId ?? null,
    nodeId: node.id,
    kind: 'element',
    tag: node.tag,
    componentTag: node.componentTag,
    calledComponentIdentity,
    sourceRange: node.sourceRange,
    props,
    componentProps: context.props,
    locals: context.locals,
    bindings: collectBindings(node.props, props),
    meta: context.iteration
      ? {
          iterationKey: context.iteration.key,
          iterationIndex: context.iteration.indexValue,
        }
      : undefined,
  })
}

/** Регистрирует узлы текста и интерполяции, хотя они не владеют DOM-элементом. */
export function registerSFCInspectionValueNode(
  node: Exclude<RComponentSFC_IR_Node, RComponentSFC_IR_ElementNode>,
  value: unknown,
  context: SFCVueRenderContext,
): string | null {
  if (!context.inspection) {
    return null
  }
  const binding = node.kind === 'expression' ? toBinding(node.value, value) : null
  return context.inspection.registerNode({
    runtimeId: getRuntimeId(context),
    componentIdentity: getComponentIdentity(context),
    componentStack: [...context.componentStack],
    scope: context.consumerScope,
    parentId: context.inspectionParentId ?? null,
    nodeId: node.id,
    kind: node.kind,
    tag: node.kind === 'text' ? '#text' : '#expression',
    sourceRange: node.sourceRange,
    props: {},
    componentProps: context.props,
    locals: context.locals,
    bindings: binding ? { value: binding } : {},
    meta: { value },
  })
}

/** Регистрирует логическую ветвь template без выполнения renderer ячеек. */
export function registerSFCInspectionDefinitionTree(
  node: RComponentSFC_IR_Node,
  context: SFCVueRenderContext,
): string | null {
  if (!context.inspection) {
    return null
  }
  if (node.kind !== 'element') {
    return registerSFCInspectionValueNode(
      node,
      node.kind === 'text' ? node.value : undefined,
      context,
    )
  }
  const props = Object.fromEntries(Object.entries(node.props).map(([key, value]) => [
    key,
    value.kind === 'literal' ? value.value : undefined,
  ]))
  const id = context.inspection.registerNode({
    runtimeId: getRuntimeId(context),
    componentIdentity: getComponentIdentity(context),
    componentStack: [...context.componentStack],
    scope: context.consumerScope,
    parentId: context.inspectionParentId ?? null,
    nodeId: node.id,
    kind: 'element',
    tag: node.tag,
    componentTag: node.componentTag,
    sourceRange: node.sourceRange,
    props,
    componentProps: context.props,
    locals: context.locals,
    bindings: collectBindings(node.props, props),
    meta: { definition: true },
  })
  const childContext = { ...context, inspectionParentId: id }
  for (const child of node.children) {
    registerSFCInspectionDefinitionTree(child, childContext)
  }
  return id
}

/** Добавляет в DOM-renderers только locator; семантический контракт остаётся основанным на сессии. */
export function createSFCInspectionAttrs(
  context: SFCVueRenderContext,
  id: string | null,
): Record<string, unknown> {
  if (!id || !context.inspection) {
    return {}
  }
  return {
    'data-endge-inspect-id': id,
    'onVnodeUnmounted': () => context.inspection?.unregisterNode(id),
  }
}

function collectBindings(
  source: Record<string, RComponentSFC_IR_Value>,
  values: Record<string, unknown>,
): Record<string, SFCRenderInspectionBinding> {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [
    key,
    toBinding(value, values[key]),
  ]))
}

function toBinding(value: RComponentSFC_IR_Value, evaluated: unknown): SFCRenderInspectionBinding {
  if (value.kind === 'literal') {
    return { kind: 'literal', reads: [], value: evaluated }
  }
  return {
    kind: 'expression',
    source: value.source,
    reads: value.reads.map(read => read.raw),
    value: evaluated,
  }
}

function getComponentIdentity(context: SFCVueRenderContext): string {
  return context.componentStack.at(-1) ?? context.host?.entityIdentity ?? 'component'
}

function getRuntimeId(context: SFCVueRenderContext): string {
  return context.host?.id ?? `sfc:${context.componentStack[0] ?? getComponentIdentity(context)}`
}
