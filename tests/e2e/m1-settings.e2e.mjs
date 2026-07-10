describe('M1 Tauri settings smoke', () => {
  it('renders the settings surface in the native application', async () => {
    const settingsButton = await $('button=설정')
    await settingsButton.waitForClickable()
    await settingsButton.click()
    const heading = await $('h2')
    await heading.waitForDisplayed()

    if ((await heading.getText()) !== '설정') {
      throw new Error('The settings screen did not render.')
    }

    const directoryButtons = await $$('button[aria-label*="루트 선택"]')
    if (directoryButtons.length !== 3) {
      throw new Error('The settings screen is missing the three workspace root selectors.')
    }
  })
})
