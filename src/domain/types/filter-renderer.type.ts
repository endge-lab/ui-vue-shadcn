import type { FilterViewRenderModel, FilterViewRuntimeHost } from '@endge/core'

export interface VueShadcnFilterRendererProps {
  runtime?: FilterViewRuntimeHost | null
  model?: FilterViewRenderModel
  readonly?: boolean
}
