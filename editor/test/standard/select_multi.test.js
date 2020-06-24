const defaults = require('../defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const podIntercept = defaults.intercept.pod()
const repoIntercept = defaults.intercept.repo()
const contentIntercept = defaults.intercept.content()

const defaultEn = ['blue']
const defaultEs = ['red']

let newValueEn = ['red', 'yellow']
let newValueEs = ['blue', 'green']

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'select',
        'key': 'colors',
        'label': 'Favorite Colors',
        'multi': true,
        'options': [
          {
            'label': 'Blue',
            'value': 'blue',
          },
          {
            'label': 'Red',
            'value': 'red',
          },
          {
            'label': 'Yellow',
            'value': 'yellow',
          },
          {
            'label': 'Green',
            'value': 'green',
          },
        ],
      },
    ]
  },
  'front_matter': {
    'colors': defaultEn,
    'colors@es': defaultEs,
  },
}

describe('select multi field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await page.goto('http://localhost:3000/editor.html')
    await page.setRequestInterception(true)

    page.on('request', defaults.interceptRequest([
      contentIntercept,
      podIntercept,
      repoIntercept,
    ]))

    await page.evaluate(_ => {
      window.editorInst = new Editor(document.querySelector('.container'), {
        'testing': true,
      })
    })
    await page.waitForSelector('.selective')
  })

  it('should be selected and deselected', async () => {
    const newValue = true

    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Unselect the default options.
    for (const value of defaultEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option:not(.selective__field__select__option--checked)[data-value="${value}"]`)
    }

    // Select the new options.
    for (const value of newValueEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option--checked[data-value="${value}"]`)
    }

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(defaults.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    let value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'colors': newValueEn,
      'colors@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select multi field selected after save', defaults.snapshotOptions)

    // Uncheck!

    // Unselect the new options.
    for (const value of newValueEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option:not(.selective__field__select__option--checked)[data-value="${value}"]`)
    }

    // Select the default options.
    for (const value of defaultEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option--checked[data-value="${value}"]`)
    }

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    await saveButton.click()
    await page.waitFor(defaults.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'colors': defaultEn,
      'colors@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select multi field deselected after save', defaults.snapshotOptions)
  })

  it('should be selected and deselected on localization', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__select__option[data-locale=en]')

    // Change the en checked options.
    // Unselect the default options.
    for (const value of defaultEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=en]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option:not(.selective__field__select__option--checked)[data-value="${value}"][data-locale=en]`)
    }

    // Select the new options.
    for (const value of newValueEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=en]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option--checked[data-value="${value}"][data-locale=en]`)
    }

    // Change the es checked options.
    // Unselect the default options.
    for (const value of defaultEs) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=es]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option:not(.selective__field__select__option--checked)[data-value="${value}"][data-locale=es]`)
    }

    // Select the new options.
    for (const value of newValueEs) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=es]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option--checked[data-value="${value}"][data-locale=es]`)
    }

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(defaults.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    let value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'colors': newValueEn,
      'colors@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select multi field selected after localization save', defaults.snapshotOptions)

    // Uncheck!

    // Change the en checked option.
    // Unselect the new options.
    for (const value of newValueEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=en]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option:not(.selective__field__select__option--checked)[data-value="${value}"][data-locale=en]`)
    }

    // Select the default options.
    for (const value of defaultEn) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=en]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option--checked[data-value="${value}"][data-locale=en]`)
    }

    // Change the es checked option.
    // Unselect the new options.
    for (const value of newValueEs) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=es]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option:not(.selective__field__select__option--checked)[data-value="${value}"][data-locale=es]`)
    }

    // Select the default options.
    for (const value of defaultEs) {
      let checkboxLabel = await page.$(`.selective__field__select__option[data-value="${value}"][data-locale=es]`)
      await checkboxLabel.click()
      await page.waitForSelector(`.selective__field__select__option--checked[data-value="${value}"][data-locale=es]`)
    }

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    await saveButton.click()
    await page.waitFor(defaults.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'colors': defaultEn,
      'colors@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select multi field deselected after localization save', defaults.snapshotOptions)
  })
})
