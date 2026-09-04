import type { ComponentSFCEventBoundary, ComponentSFCRequiredPortBinding, ComponentSFCRuntimeHost, EndgeStyleMatchNode, EndgeStyleSheetArtifact, ProgramMetadata, RComponentSFC_IR, SFCRenderInspectionSessionLike } from '@endge/core'
import type { SFCVueRenderContext, SFCVueRenderIteration } from '@/services/render/sfc/sfc-shadcn-render.type'
import type { ShadcnTooltipManager } from '@/ui/overlay/tooltip/shadcn-tooltip-manager'
import { Endge, ComponentSFCEventBoundary as EndgeComponentSFCEventBoundary } from '@endge/core'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

/** Создает root context для одного render pass SFC renderer adapter. */
export function createSFCVueRenderContext(
  props: Record<string, unknown> | undefined,
  renderVersion = 0,
  host: ComponentSFCRuntimeHost | null = null,
  ir: RComponentSFC_IR | null = null,
  componentStack: readonly string[] = host?.entityIdentity ? [host.entityIdentity] : [],
  consumerScope = 'root',
  inheritedStyleArtifacts?: readonly EndgeStyleSheetArtifact[],
  inheritedEventBoundary?: ComponentSFCEventBoundary | null,
  inspection: SFCRenderInspectionSessionLike | null = null,
  metadata?: ProgramMetadata | null,
  variant = 'default',
  tooltipManager: ShadcnTooltipManager | null = null,
  portBindings: readonly ComponentSFCRequiredPortBinding[] = [],
): SFCVueRenderContext {
  const lifecycleScope = host ? Endge.runtime.getRuntimeScopeByHost(host.id) : null
  const runtimeScopeIds: string[] = []
  for (let current = lifecycleScope; current; current = current.parent) {
    runtimeScopeIds.unshift(current.id)
  }
  const styleArtifacts = inheritedStyleArtifacts
    ? [...inheritedStyleArtifacts]
    : [...Endge.styles.getActiveArtifacts()]
  if (ir?.style && !styleArtifacts.includes(ir.style)) {
    styleArtifacts.push(ir.style)
  }
  const context: SFCVueRenderContext = {
    props: props ?? {},
    context: Object.freeze(Endge.context.runtimeSnapshot()),
    locals: {},
    iteration: null,
    renderVersion,
    host,
    runtimeState: (host as any)?.runtimeState ?? null,
    componentStack,
    consumerScope,
    portBindings,
    variant,
    styleArtifacts,
    styleParent: undefined,
    styleSiblings: [],
    styleSiblingCount: 0,
    styleOwnerScopeId: ir?.style?.scopeId,
    runtimeScopeIds,
    eventBoundary: inheritedEventBoundary ?? (ir
      ? new EndgeComponentSFCEventBoundary(host, host?.entityIdentity ?? componentStack.at(-1) ?? 'component', ir.script.ports)
      : null),
    inspection,
    inspectionParentId: null,
    metadata: metadata ?? host?.getArtifact()?.metadata ?? null,
    tooltipManager,
  }
  context.locals = evaluatePortLocals(ir, context)
  return context
}

/** Создает дочерний context с дополнительными локальными значениями. */
export function extendSFCVueRenderContext(
  context: SFCVueRenderContext,
  locals: Record<string, unknown>,
  iteration: SFCVueRenderIteration | null = context.iteration,
  consumerScope = context.consumerScope,
): SFCVueRenderContext {
  return {
    props: context.props,
    context: context.context,
    locals: {
      ...context.locals,
      ...locals,
    },
    iteration,
    renderVersion: context.renderVersion,
    host: context.host,
    runtimeState: context.runtimeState,
    componentStack: context.componentStack,
    consumerScope,
    portBindings: context.portBindings ?? [],
    variant: context.variant,
    styleArtifacts: context.styleArtifacts,
    styleParent: context.styleParent,
    styleSiblings: context.styleSiblings,
    styleSiblingCount: context.styleSiblingCount,
    styleOwnerScopeId: context.styleOwnerScopeId,
    runtimeScopeIds: context.runtimeScopeIds,
    eventBoundary: context.eventBoundary,
    inspection: context.inspection,
    inspectionParentId: context.inspectionParentId,
    metadata: context.metadata,
    tooltipManager: context.tooltipManager,
  }
}

/** Создаёт логический дочерний frame, не перенося физические Vue-обёртки в семантику селекторов. */
export function extendSFCVueStyleContext(
  context: SFCVueRenderContext,
  parent: EndgeStyleMatchNode,
): SFCVueRenderContext {
  return {
    ...context,
    styleParent: parent,
    styleSiblings: [],
    styleSiblingCount: 0,
  }
}

function evaluatePortLocals(
  ir: RComponentSFC_IR | null,
  context: SFCVueRenderContext,
): Record<string, unknown> {
  const locals: Record<string, unknown> = {}
  if (!ir) {
    return locals
  }

  for (const call of ir.script.portCalls ?? []) {
    context.locals = locals
    const input = evaluateSFCValue(call.input, context)
    const consumerKey = `${context.consumerScope}:${context.componentStack.join('>')}:${call.port}:${call.local}`
    const identity = context.portBindings?.find(binding => binding.port === call.port && binding.kind === 'computation')?.identity
      ?? call.defaultIdentity
    locals[call.local] = context.host
      ? context.host.getComputationResource(identity, input, consumerKey, call.port)
      : Endge.runtime.computation.createResource(identity, input, consumerKey)
  }
  return locals
}
