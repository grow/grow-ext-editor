const defaults = require('../defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const podIntercept = defaults.intercept.pod()
const repoIntercept = defaults.intercept.repo()
const contentIntercept = defaults.intercept.content()

const defaultEn = false
const defaultEs = false

let newValueEn = true
let newValueEs = true

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'checkbox',
        'key': 'is_required',
        'label': 'Is required?',
      },
    ]
  },
  'front_matter': {
    'is_required': defaultEn,
    'is_required@es': defaultEs,
  },
}

describe('checkbox field', () => {
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

  it('should be checked and unchecked', async () => {
    const newValue = true

    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Change the checked state.
    let checkboxLabel = await page.$('.selective__field__input__option')
    await checkboxLabel.click()
    await page.waitForSelector('.selective__field__input__option--selected')

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
      'is_required': newValueEn,
      'is_required@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Checkbox field checked after save', defaults.snapshotOptions)

    // Uncheck!

    // Change the checked state.
    await checkboxLabel.click()
    await page.waitForSelector('.selective__field__input__option:not(.selective__field__input__option--selected)')

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
      'is_required': !newValueEn,
      'is_required@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Checkbox field unchecked after save', defaults.snapshotOptions)
  })

  it('should be checked and unchecked on localization', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__input__option[data-locale=en]')

    // Change the en checked state.
    let checkboxLabelEn = await page.$('.selective__field__input__option[data-locale=en]')
    await checkboxLabelEn.click()
    await page.waitForSelector('.selective__field__input__option--selected[data-locale=en]')

    // Change the es checked state.
    let checkboxLabelEs = await page.$('.selective__field__input__option[data-locale=es]')
    await checkboxLabelEs.click()
    await page.waitForSelector('.selective__field__input__option--selected[data-locale=es]')

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
      'is_required': newValueEn,
      'is_required@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Checkbox field checked after localization save', defaults.snapshotOptions)

    // Uncheck!

    // Change the en checked state.
    await checkboxLabelEn.click()
    await page.waitForSelector('.selective__field__input__option:not(.selective__field__input__option--selected)[data-locale=en]')

    // Change the es checked state.
    await checkboxLabelEs.click()
    await page.waitForSelector('.selective__field__input__option:not(.selective__field__input__option--selected)[data-locale=es]')

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
      'is_required': !newValueEn,
      'is_required@es': !newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Checkbox field unchecked after localization save', defaults.snapshotOptions)
  })
})
