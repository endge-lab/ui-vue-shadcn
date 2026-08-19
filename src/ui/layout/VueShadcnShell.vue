<script setup lang="ts">
import type { EndgeEnvId, EndgeProjectId } from '@endge/core'
import { DEFAULT_ENDGE_TOOLTIP_CONFIGURATION, Endge } from '@endge/core'
import { onBeforeUnmount, provide } from 'vue'

import ShadcnMenuRoot from '@/ui/overlay/ShadcnMenuRoot.vue'
import ShadcnTooltipRoot from '@/ui/overlay/tooltip/ShadcnTooltipRoot.vue'
import { ShadcnTooltipManager, ShadcnTooltipManagerKey } from '@/ui/overlay/tooltip/shadcn-tooltip-manager'

defineOptions({ name: 'EndgeVueShadcnShell' })

defineProps<{
  project: EndgeProjectId
  env: EndgeEnvId
}>()

const tooltipManager = new ShadcnTooltipManager(resolveTooltipConfiguration())
provide(ShadcnTooltipManagerKey, tooltipManager)
onBeforeUnmount(() => tooltipManager.dispose())

function resolveTooltipConfiguration() {
  try {
    return Endge.configuration.current.tooltips
  }
  catch {
    return { ...DEFAULT_ENDGE_TOOLTIP_CONFIGURATION }
  }
}
</script>

<template>
  <slot />
  <ShadcnMenuRoot />
  <ShadcnTooltipRoot :manager="tooltipManager" />
</template>
