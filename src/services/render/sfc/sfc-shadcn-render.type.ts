import type {
  ComponentSFCEventBoundary,
  ComponentSFCRequiredPortBinding,
  ComponentSFCRuntimeHost,
  EndgeRuntimeContextSnapshot,
  EndgeStyleMatchNode,
  EndgeStyleSheetArtifact,
  ProgramMetadata,
  RComponentSFC_IR,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
  RComponentSFC_IR_Tag,
  RComponentSFC_IR_Value,
  RuntimeBoundaryPatch,
  RuntimeHostInputSource,
  RuntimeHostLocalInputSource,
  RuntimeHostRaphInputBinding,
  RuntimeHostRaphInputSource,
  SFCRenderInspectionSessionLike,
  UIRenderAdapter,
} from '@endge/core'
import type { VNode, h as VueH } from 'vue'
import type { ShadcnTooltipManager } from '@/ui/overlay/tooltip/shadcn-tooltip-manager'
import { ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS } from '@endge/core'

/** Полный контракт Vue adapter-а: простые primitives и compound Table renderer. */
export const SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS = [
  ...ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  'Tooltip',
  'Table',
] as const

export type SFCVueRenderAdapterKey = typeof SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS[number]

/** Поддерживаемые SFC primitive-теги во Vue adapter. */
export type SFCVueRenderPrimitive = RComponentSFC_IR_Tag

/** Будущий контракт binding-ов renderer adapter. */
export type SFCVueRenderBinding
  = | {
    kind: 'literal'
    value: unknown
  }
  | {
    kind: 'prop'
    path: string
  }

/** Контекст текущего SFC render pass. */
export interface SFCVueRenderContext {
  props: Record<string, unknown>
  /** Read-only snapshot глобального Endge context для текущего render pass. */
  context: Readonly<EndgeRuntimeContextSnapshot>
  locals: Record<string, unknown>
  iteration: SFCVueRenderIteration | null
  renderVersion: number
  host: ComponentSFCRuntimeHost | null
  runtimeState: SFCVueRuntimeStateController | null
  /** Stack identity текущего component-call для защиты от recursive render cycles. */
  componentStack: readonly string[]
  /** Стабильный scope renderer для изоляции ресурсов computation, принадлежащих host. */
  consumerScope: string
  /** Фактические провайдеры обязательных портов текущего смонтированного экземпляра SFC. */
  portBindings?: readonly ComponentSFCRequiredPortBinding[]
  /** Активный renderer-neutral вариант текущего component boundary. */
  variant: string
  /** Фактические глобальные, родительские и локальные артефакты стилей этой границы. */
  styleArtifacts: readonly EndgeStyleSheetArtifact[]
  /** Логический родитель в абстрактном дереве SFC. */
  styleParent: EndgeStyleMatchNode | undefined
  /** Уже отображённые логические соседние узлы; физических Vue-обёрток здесь нет. */
  styleSiblings: EndgeStyleMatchNode[]
  /** Ожидаемое число логических соседних узлов для структурных псевдоселекторов. */
  styleSiblingCount: number
  /** Текущий владелец SFC в рамках scope. */
  styleOwnerScopeId: string | undefined
  /** Иерархия lifecycle runtime для изоляции границы renderer. */
  runtimeScopeIds: readonly string[]
  /** Семантический router Event уровня mount для текущего артефакта Component SFC. */
  eventBoundary?: ComponentSFCEventBoundary | null
  /** Необязательный debug sink, включаемый Configurator; null в обычном runtime. */
  inspection?: SFCRenderInspectionSessionLike | null
  /** ID родительского live-экземпляра в семантическом дереве инспекции. */
  inspectionParentId?: string | null
  /** Compiled metadata текущего Component SFC artifact. */
  metadata: ProgramMetadata | null
  tooltipManager?: ShadcnTooltipManager | null
}

/** Контракт контроллера структурного runtime-состояния для render-адаптеров Vue. */
export interface SFCVueRuntimeStateController {
  readonly runtimeId: string
  readonly storageKey: string

  get: <T>(entityKey: string, section: string, fallback: T) => T

  set: <T>(entityKey: string, section: string, value: T) => void

  remove: (entityKey: string, section?: string) => void

  clear: () => void
}

/** Данные текущей for-итерации. */
export interface SFCVueRenderIteration {
  item: string
  index?: string
  value: unknown
  indexValue: number
  key: unknown
}

/** Входные props корневого SFC renderer adapter. */
export interface SFCVueRenderAdapterProps {
  ir: RComponentSFC_IR | null
  props?: Record<string, unknown>
  renderVersion?: number
  host?: ComponentSFCRuntimeHost | null
  inspection?: SFCRenderInspectionSessionLike | null
}

/** Локальный источник входных props для runtime renderer-а. */
export type SFCVueLocalInputSource = RuntimeHostLocalInputSource

/** Binding на runtime/Raph источник данных. */
export type SFCVueRaphInputBinding = RuntimeHostRaphInputBinding

/** Источник входных props из runtime/Raph-хранилища. */
export type SFCVueRaphInputSource = RuntimeHostRaphInputSource

/** Источник входных props для SFC runtime bridge. */
export type SFCVueRuntimeInputSource = RuntimeHostInputSource

/** Вход Vue runtime renderer-а, связывающего RuntimeHost и render root. */
export interface SFCVueRuntimeRendererProps {
  host: ComponentSFCRuntimeHost | null
  input: SFCVueRuntimeInputSource
  inspection?: SFCRenderInspectionSessionLike | null
}

/** Callback обновления materialized props из runtime bridge в Vue root. */
export type SFCVueRuntimeBridgeUpdate = (
  props: Record<string, unknown>,
) => void

/** Callback точечного patch-а от runtime boundary в Vue adapter. */
export type SFCVueRuntimeBridgeBoundaryPatch = (
  patch: RuntimeBoundaryPatch,
) => void | boolean | Promise<void | boolean>

/** Тип Vue h-функции, который нужен renderer-слою без привязки к компоненту. */
export type SFCVueRenderH = typeof VueH

/** Результат рендера одного SFC узла. */
export type SFCVueRenderResult = VNode | string | null

/** Результат рендера списка SFC узлов. */
export type SFCVueRenderListResult = Array<VNode | string>

/** Вход renderer-а одного SFC element node. */
export interface SFCVueRenderElementInput {
  h: SFCVueRenderH
  node: RComponentSFC_IR_ElementNode
  context: SFCVueRenderContext
  children: SFCVueRenderListResult
  renderChildren: (context: SFCVueRenderContext) => SFCVueRenderListResult
  renderNodes: (nodes: RComponentSFC_IR_Node[], context: SFCVueRenderContext) => SFCVueRenderListResult
  props: Record<string, unknown>
  attrs: Record<string, unknown>
}

/** Нормализованный вход visual primitive renderer-а без compiler/runtime деталей. */
export type SFCVueRenderAdapterElementInput = Pick<
  SFCVueRenderElementInput,
  'h' | 'children' | 'props' | 'attrs'
>

/** Renderer одной visual primitive внутри Vue adapter-а. */
export type SFCVueRenderAdapterFunction = (
  input: SFCVueRenderAdapterElementInput,
) => SFCVueRenderResult

/** Функция renderer-а одного SFC primitive или compound-тега. */
export type SFCVueRenderFunction = (
  input: SFCVueRenderElementInput,
) => SFCVueRenderResult

/** Полный набор visual и compound renderers Vue adapter-а. */
export type SFCVueRenderAdapterRendererMap = Record<
  SFCVueRenderAdapterKey,
  SFCVueRenderFunction
>

/** Типизированный SFC adapter для Vue render engine. */
export interface SFCVueRenderAdapter extends UIRenderAdapter<SFCVueRenderFunction> {
  protocol: 'endge-sfc'
  protocolVersion: 1
  renderer: 'vue-shadcn'
  renderers: SFCVueRenderAdapterRendererMap
  roots: {
    'shell': unknown
    'sfc': unknown
    'sfc-runtime': unknown
    'filter-view': unknown
  }
}

/** Вход функции рендера произвольного SFC IR узла. */
export interface SFCVueRenderNodeInput {
  h: SFCVueRenderH
  node: RComponentSFC_IR_Node
  context: SFCVueRenderContext
}

/** Настройки условного рендера, вычисленные из sibling chain. */
export interface SFCVueRenderConditionState {
  shouldRender: boolean
  startsChain: boolean
  matchedChain: boolean
  closesChain: boolean
}

/** Нормализованное значение style prop. */
export type SFCVueRenderStyleValue = string | number | null | undefined

/** Сервисная функция вычисления IR-значений. */
export type SFCVueRenderValueEvaluator = (
  value: RComponentSFC_IR_Value | undefined,
  context: SFCVueRenderContext,
) => unknown
