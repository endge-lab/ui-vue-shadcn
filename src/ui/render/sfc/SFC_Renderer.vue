<script setup lang="ts">
import type { SFCVueRenderAdapterProps } from '@/model/render/sfc/sfc-shadcn-render.type'
import { Endge } from '@endge/core'
import { computed, defineComponent, Fragment, h, inject, onScopeDispose, ref } from 'vue'
import { registerSFCInspectionRoot } from '@/model/render/sfc/SFCVueRenderInspection'
import { ShadcnTooltipManagerKey } from '@/ui/overlay/tooltip/shadcn-tooltip-manager'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

const props = defineProps<SFCVueRenderAdapterProps>()
const adapterVersion = ref(0)
const tooltipManager = inject(ShadcnTooltipManagerKey, null)

const unsubscribeUIRegistry = Endge.uiRegistry.subscribe(() => {
  adapterVersion.value += 1
})
onScopeDispose(unsubscribeUIRegistry)

const context = computed(() => createSFCVueRenderContext(
  props.props,
  props.renderVersion ?? 0,
  props.host ?? null,
  props.ir,
  undefined,
  undefined,
  undefined,
  undefined,
  props.inspection ?? null,
  undefined,
  'default',
  tooltipManager,
))

const RenderRoot = defineComponent({
  name: 'SFCRenderRoot',
  setup() {
    return () => {
      adapterVersion.value
      if (!props.ir) {
        return null
      }

      const renderContext = context.value
      renderContext.inspectionParentId = renderContext.inspection
        ? registerSFCInspectionRoot(renderContext)
        : null
      return h(Fragment, null, renderSFCNodes(
        h,
        props.ir.template.roots,
        renderContext,
      ))
    }
  },
})
</script>

<template>
  <RenderRoot />
</template>
