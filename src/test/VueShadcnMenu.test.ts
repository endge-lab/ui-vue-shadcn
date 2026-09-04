import { BUILTIN_ACTION_IDS } from '@endge/core'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  closeShadcnMenu,
  executeShadcnMenuItem,
  openShadcnMenu,
} from '@/ui/overlay/shadcn-menu-manager'

describe('проверка Actions меню Vue Shadcn', () => {
  afterEach(() => closeShadcnMenu())

  it('передаёт скомпилированный input в единый facade Action', async () => {
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
