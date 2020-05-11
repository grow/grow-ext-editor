const defaults = require('../defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const editorConfig = {
  'fields': [
    {
      'type': 'select',
      'key': 'color',
      'label': 'Favorite Color',
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
      ],
    }
  ]
}
const defaultEn = 'blue'
const defaultEs = 'red'
let newValueEn = 'yellow'
let newValueEs = 'blue'

describe('select single field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await page.goto('http://localhost:3000/editor.html')
    await page.setRequestInterception(true)

    page.on('request', request => {
      if (request.url().includes('/_grow/api/editor/content')) {
        // console.log('Intercepted content', request.url(), request.method())
        if (request.method() == 'POST') {
          // Respond to posts with the same front matter.
          const postData = qs.parse(request.postData())
          const frontMatter = JSON.parse(postData.front_matter)
          request.respond({
            contentType: 'application/json',
            body: JSON.stringify(Object.assign({}, defaults.documentResponse, {
              'front_matter': frontMatter,
              'editor': editorConfig,
            }))
          })
        } else {
          request.respond({
            contentType: 'application/json',
            body: JSON.stringify(Object.assign({}, defaults.documentResponse, {
              'front_matter': {
                'color': defaultEn,
                'color@es': defaultEs,
              },
              'editor': editorConfig,
            }))
          })
        }
      } else {
        // console.log('Piped request', request.url(), request.method())
        request.continue()
      }
    })

    await page.evaluate(_ => {
      window.editorInst = new Editor(document.querySelector('.container'), {
        'testing': true,
      })
    })
    await page.waitForSelector('.selective')
  })

  it('should be selected and changed', async () => {
    const newValue = true

    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Change the checked option.
    let checkboxLabel = await page.$(`.selective__field__select__option[data-value=${newValueEn}]`)
    await checkboxLabel.click()
    await page.waitForSelector(`.selective__field__select__option--checked[data-value=${newValueEn}]`)

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
      'color': newValueEn,
      'color@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select single field checked after save', defaults.snapshotOptions)

    // Uncheck!

    // Change the checked option.
    checkboxLabel = await page.$(`.selective__field__select__option[data-value=${defaultEn}]`)
    await checkboxLabel.click()
    await page.waitForSelector(`.selective__field__select__option--checked[data-value=${defaultEn}]`)

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
      'color': defaultEn,
      'color@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select single field unselected after save', defaults.snapshotOptions)
  })

  it('should be selected and changed on localization', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__select__option[data-locale=en]')

    // Change the en checked option.
    let checkboxLabel = await page.$(`.selective__field__select__option[data-value=${newValueEn}][data-locale=en]`)
    await checkboxLabel.click()
    await page.waitForSelector(`.selective__field__select__option--checked[data-value=${newValueEn}][data-locale=en]`)

    // Change the es checked option.
    checkboxLabel = await page.$(`.selective__field__select__option[data-value=${newValueEs}][data-locale=es]`)
    await checkboxLabel.click()
    await page.waitForSelector(`.selective__field__select__option--checked[data-value=${newValueEs}][data-locale=es]`)

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
      'color': newValueEn,
      'color@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select single field checked after localization save', defaults.snapshotOptions)

    // Uncheck!

    // Change the en checked option.
    checkboxLabel = await page.$(`.selective__field__select__option[data-value=${defaultEn}][data-locale=en]`)
    await checkboxLabel.click()
    await page.waitForSelector(`.selective__field__select__option--checked[data-value=${defaultEn}][data-locale=en]`)

    // Change the es checked option.
    checkboxLabel = await page.$(`.selective__field__select__option[data-value=${defaultEs}][data-locale=es]`)
    await checkboxLabel.click()
    await page.waitForSelector(`.selective__field__select__option--checked[data-value=${defaultEs}][data-locale=es]`)

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
      'color': defaultEn,
      'color@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Select single field unselected after localization save', defaults.snapshotOptions)
  })
})
