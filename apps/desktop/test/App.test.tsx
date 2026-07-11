// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { defaultAppSettings } from '@datamanager/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../src/app/App'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('App workspace navigation', () => {
  it('exposes all six work areas and supports keyboard activation', async () => {
    const user = userEvent.setup()
    render(<App />)

    const labels = ['관계도', '테이블', 'Enum', 'Excel', '코드 생성', '설정']
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: '관계도' }).getAttribute('aria-current')).toBe('page')

    const enumButton = screen.getByRole('button', { name: 'Enum' })
    enumButton.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Enum', level: 2 })).toBeTruthy()
    expect(enumButton.getAttribute('aria-current')).toBe('page')

    const settingsButton = screen.getByRole('button', { name: '설정' })
    settingsButton.focus()
    await user.keyboard(' ')
    expect(await screen.findByRole('heading', { name: '설정', level: 2 })).toBeTruthy()
  })

  it('resets the schema editor when switching between Table and Enum areas', async () => {
    window.localStorage.setItem(
      'datamanager.settings.v2',
      JSON.stringify({ ...defaultAppSettings, protoRoot: 'D:\\Proto' })
    )
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '테이블' }))
    await user.click(await screen.findByRole('button', { name: '테이블 추가' }))
    await user.type(screen.getByRole('textbox', { name: 'Message 이름' }), 'UnsavedTable')
    expect(screen.getByDisplayValue('UnsavedTable')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Enum' }))
    expect(await screen.findByRole('heading', { name: 'Enum', level: 2 })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Message 이름' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Enum 추가' }))
    await user.type(screen.getByRole('textbox', { name: 'Enum 이름' }), 'UnsavedEnum')
    expect(screen.getByDisplayValue('UnsavedEnum')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '테이블' }))
    expect(await screen.findByRole('heading', { name: '테이블', level: 2 })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Enum 이름' })).toBeNull()
    expect(screen.queryByDisplayValue('UnsavedTable')).toBeNull()
  })
})
