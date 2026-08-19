import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { markRaw } from 'vue'

import type { SFCVueRenderAdapter } from '@/domain/types/sfc-render.type'
import VueShadcnFilterRenderer from '@/ui/filter/VueShadcnFilterRenderer.vue'
import VueShadcnShell from '@/ui/layout/VueShadcnShell.vue'
import SFC_Renderer from '@/ui/render/sfc/SFC_Renderer.vue'
import SFC_RuntimeRenderer from '@/ui/render/sfc/SFC_RuntimeRenderer.vue'

import {
  VueShadcnRender_Badge,
  VueShadcnRender_Box,
  VueShadcnRender_Checkbox,
  VueShadcnRender_DateTime,
  VueShadcnRender_Divider,
  VueShadcnRender_Dot,
  VueShadcnRender_Flex,
  VueShadcnRender_Grid,
  VueShadcnRender_Icon,
  VueShadcnRender_Input,
  VueShadcnRender_Number,
  VueShadcnRender_Select,
  VueShadcnRender_Text,
  VueShadcnRender_Textarea,
} from '@/model/render/sfc/vue-shadcn-renderers'
import { VueShadcnRender_Table } from '@/model/render/sfc/vue-shadcn-table-renderer'
import { VueShadcnRender_Tooltip } from '@/model/render/sfc/vue-shadcn-tooltip-renderer'

export const VUE_SHADCN_SFC_ADAPTER_ID = 'vue-shadcn'

/** Self-contained vue-shadcn visual adapter for the Endge Vue SFC renderer. */
export const VueShadcnSFCAdapter: SFCVueRenderAdapter = {
  id: VUE_SHADCN_SFC_ADAPTER_ID,
  protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  renderer: 'vue-shadcn',
  renderers: {
    Text: VueShadcnRender_Text,
    DateTime: VueShadcnRender_DateTime,
    Number: VueShadcnRender_Number,
    Icon: VueShadcnRender_Icon,
    Badge: VueShadcnRender_Badge,
    Dot: VueShadcnRender_Dot,
    Box: VueShadcnRender_Box,
    Flex: VueShadcnRender_Flex,
    Grid: VueShadcnRender_Grid,
    Divider: VueShadcnRender_Divider,
    Input: VueShadcnRender_Input,
    Textarea: VueShadcnRender_Textarea,
    Checkbox: VueShadcnRender_Checkbox,
    Select: VueShadcnRender_Select,
    Tooltip: VueShadcnRender_Tooltip,
    Table: VueShadcnRender_Table,
  },
  roots: {
    shell: markRaw(VueShadcnShell),
    sfc: markRaw(SFC_Renderer),
    'sfc-runtime': markRaw(SFC_RuntimeRenderer),
    'filter-view': markRaw(VueShadcnFilterRenderer),
  },
}
