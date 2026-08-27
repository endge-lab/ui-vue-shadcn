import { BUILTIN_ACTION_IDS } from '@endge/core'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  closeShadcnMenu,
  executeShadcnMenuItem,
  openShadcnMenu,
} from '@/ui/overlay/shadcn-menu-manager'

describe('vue-shadcn menu Actions', () => {
  afterEach(() => closeShadcnMenu())

  it('passes compiled input to the unified Action facade', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    openShadcnMenu({
      ownerId: 'test-menu',
      anchor: { kind: 'point', x: 0, y: 0 },
      menu: { kind: 'context-menu', items: [] },
      context: { surface: 'test-menu' },
    })

    await executeShadcnMenuItem({
      kind: 'item',
      id: 'debug',
      label: 'Debug',
      action: BUILTIN_ACTION_IDS.consoleLog,
      input: { message: 'Контекстное меню работает' },
    })

    expect(consoleLog).toHaveBeenCalledWith('Контекстное меню работает')
    consoleLog.mockRestore()
  })
})
