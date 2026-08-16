import type {
  ComponentSFCTableColumnMenuDescriptor,
  ComponentSFCTableRowMenuDescriptor,
  ComponentSFCTableColumnPinMode,
  ComponentSFCTableColumnPinStateItem,
  ComponentSFCTableSortComparator,
  ComponentSFCTableSortMode,
  ComponentSFCTableSortStateItem,
  ComponentSFCEventBoundary,
  RComponentSFC_IR_EventBinding,
  RComponentSFC_IR_Node,
  TableSelectionMode,
  TableSelectionTrigger,
} from '@endge/core'
import type {
  SFCVueRenderContext,
  SFCVueRenderResult,
  SFCVueRuntimeStateController,
} from '@/domain/types/sfc-render.type'
import type { SFCTableColumnStyleSurfaces, SFCTableStyleContract } from '@/ui/render/sfc/SFCRender_TableStyle'

export interface EndgeShadcnTableColumnSort {
  sortable: boolean
  comparator: ComponentSFCTableSortComparator
  paths: string[]
}

export interface EndgeShadcnTableColumn {
  index: number
  key: string
  title: string
  width: number | null
  minWidth: number
  maxWidth: number
  pinnable: boolean
  sort: EndgeShadcnTableColumnSort | null
  cellNodes: RComponentSFC_IR_Node[]
  styleSurfaces: SFCTableColumnStyleSurfaces
}

export type EndgeShadcnTablePaging = 'pages' | 'virtual'

export interface EndgeShadcnTableProps {
  boundaryId: string
  nodeId?: string
  tableRef?: string | null
  tableId: string
  eventBoundary?: ComponentSFCEventBoundary | null
  eventBindings?: RComponentSFC_IR_EventBinding[]
  selectionMode?: TableSelectionMode
  selectionTrigger?: TableSelectionTrigger
  runtimeState: SFCVueRuntimeStateController | null
  columns: EndgeShadcnTableColumn[]
  source: Record<string, unknown>[]
  styleContract: SFCTableStyleContract
  rowKey: string
  sortMode: ComponentSFCTableSortMode
  pinMode: ComponentSFCTableColumnPinMode
  columnMenu: ComponentSFCTableColumnMenuDescriptor
  rowMenu?: ComponentSFCTableRowMenuDescriptor
  menuContext?: SFCVueRenderContext
  defaultSort: ComponentSFCTableSortStateItem[]
  defaultPin: ComponentSFCTableColumnPinStateItem[]
  defaultHidden: string[]
  rowSize: number
  paging?: EndgeShadcnTablePaging
  pageSize?: number
  pageSizes?: number[]
  lazy?: boolean
  renderVersion: number
  renderCell: (
    column: EndgeShadcnTableColumn,
    row: Record<string, unknown>,
    rowIndex: number,
    rowId: string,
  ) => SFCVueRenderResult
}
