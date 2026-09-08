<script setup lang="ts">
import type { SFCVueRenderAdapterProps } from '@/services/render/sfc/sfc-shadcn-render.type'
import { Endge } from '@endge/core'
import { computed, defineComponent, Fragment, getCurrentInstance, h, inject, onScopeDispose, ref, watch } from 'vue'
import { registerSFCInspectionRoot } from '@/services/render/sfc/SFCVueRenderInspection'
import { ShadcnTooltipManagerKey } from '@/ui/overlay/tooltip/shadcn-tooltip-manager'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

const props = defineProps<SFCVueRenderAdapterProps>()
const adapterVersion = ref(0)
const consumerScope = `renderer:${getCurrentInstance()!.uid}`
watch(() => [props.host, props.ir] as const, (_next, previous) => {
  previous?.[0]?.releaseComputationResources(consumerScope)
}, { flush: 'sync' })
onScopeDispose(() => props.host?.releaseComputationResources(consumerScope))
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
  consumerScope,
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
      void adapterVersion.value
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
