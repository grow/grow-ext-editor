const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()

const defaultEn = 'Trumpet'
const defaultEs = 'Trompeta'

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'text',
        'key': 'title',
        'label': 'Title',
      },
    ]
  },
  'front_matter': {
    'title': defaultEn,
    'title@es': defaultEs,
  },
}

let newValueEn = 'Trombone'
let newValueEs = 'Trombón'

describe('text field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await shared.pageSetup(page, [
      contentIntercept,
    ])
  })

  it('should accept input', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Change the title.
    await page.click('.selective__field__type__text input', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEn)

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'title': newValueEn,
      'title@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Text field after save', shared.snapshotOptions)
  })

  it('should accept input on localization', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__type__text input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__type__text input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEn)

    // Change the es title.
    await page.click('.selective__field__type__text input[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEs)

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'title': newValueEn,
      'title@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Text field after localization save', shared.snapshotOptions)
  })

  it('should expand to textarea on localization', async () => {
    newValueEn = 'Seventy six trombones led the big parade with a hundred and ten cornets close at hand.'
    newValueEs = 'Setenta y seis trombones encabezaron el gran desfile con ciento diez cornetas al alcance de la mano.'

    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__type__text input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__type__text input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    // Need to delay input waiting for the input adjustment to propagate.
    await page.keyboard.type(newValueEn, {delay: 1})
    await page.waitFor(100)  // Wait for 100 ms to make sure textarea is ready.

    // Change the en title to make sure it got all of the value.
    await page.click('.selective__field__type__text textarea[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEn)

    // Change the es title.
    await page.click('.selective__field__type__text input[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    // Need to delay input waiting for the input adjustment to propagate.
    await page.keyboard.type(newValueEs, {delay: 1})
    await page.waitFor(100)  // Wait for 100 ms to make sure textarea is ready.

    // Change the en title to make sure it got all of the value.
    await page.click('.selective__field__type__text textarea[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEs)

    // Check for textareas.
    await expect(page).toMatchElement('.selective__field__type__text textarea[data-locale=en]')
    await expect(page).toMatchElement('.selective__field__type__text textarea[data-locale=es]')

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'title': newValueEn,
      'title@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Text field expanded after localization save', shared.snapshotOptions)
  })
})
