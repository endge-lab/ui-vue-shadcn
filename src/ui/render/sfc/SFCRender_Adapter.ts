import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  Endge,
} from '@endge/core'

import type {
  SFCVueRenderAdapterKey,
  SFCVueRenderFunction,
} from '@/domain/types/sfc-render.type'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/domain/types/sfc-render.type'

/** Resolves one renderer from the active Shadcn adapter for structural renderers. */
export function requireSFCAdapterRenderer(tag: SFCVueRenderAdapterKey): SFCVueRenderFunction {
  const adapter = Endge.uiRegistry.adapters.requireActive<SFCVueRenderFunction>({
    protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
    protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
    renderer: 'vue-shadcn',
    requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
  })
  const renderFn = adapter.renderers[tag]
  if (!renderFn) {
    throw new Error(`[SFCRender_Adapter] adapter "${adapter.id}" has no renderer for "${tag}"`)
  }
  return renderFn
}
