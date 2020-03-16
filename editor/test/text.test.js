const defaults = require('./defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

describe('text field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await page.goto('http://localhost:3000/editor.html')
    await page.setRequestInterception(true)

    page.on('request', request => {
      if (request.url().includes('/_grow/api/editor/content')) {
        console.log('Intercepted content', request.url(), request.method())
        if (request.method() == 'POST') {
          // Respond to posts with the same front matter.
          const postData = qs.parse(request.postData())
          const frontMatter = JSON.parse(postData.front_matter)
          request.respond({
            contentType: 'application/json',
            body: JSON.stringify(Object.assign({}, defaults.documentResponse, {
              'front_matter': frontMatter,
            }))
          })
        } else {
          request.respond({
            contentType: 'application/json',
            body: JSON.stringify(Object.assign({}, defaults.documentResponse, {
              'front_matter': {
                'title': 'Trumpet',
                'title@es': 'Trompeta',
              },
            }))
          })
        }
      } else {
        console.log('Piped request', request.url(), request.method())
        request.continue()
      }
    })

    await page.evaluate(_ => {
      window.editorInst = new Editor(document.querySelector('.container'), {
        'testing': true,
      })
    })
    await page.waitForSelector('.selective__fields')
  })

  it('should accept input', async () => {
    const newValue = 'Trombone'

    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Change the title.
    await page.click('.selective__field__text input', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValue)

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitForSelector('.editor__save--saving')
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'title': newValue,
      'title@es': 'Trompeta',
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Text field after save')
  })

  it('should accept input on localization', async () => {
    const newValue = 'Trombone'
    const newValueEs = 'Trombón'

    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__text input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__text input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValue)

    // Change the es title.
    await page.click('.selective__field__text input[data-locale=es]', {clickCount: 3})
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
    await page.waitForSelector('.editor__save--saving')
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'title': newValue,
      'title@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Text field after localization save')
  })

  it('should expand to textarea on localization', async () => {
    const newValue = 'Seventy six trombones led the big parade with a hundred and ten cornets close at hand.'
    const newValueEs = 'Setenta y seis trombones encabezaron el gran desfile con ciento diez cornetas al alcance de la mano.'

    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__text input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__text input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    // Need to delay input waiting for the input adjustment to propagate.
    await page.keyboard.type(newValue, {delay: 1})

    // Change the en title to make sure it got all of the value.
    await page.click('.selective__field__text textarea[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValue)

    // Change the es title.
    await page.click('.selective__field__text input[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    // Need to delay input waiting for the input adjustment to propagate.
    await page.keyboard.type(newValueEs, {delay: 1})

    // Change the en title to make sure it got all of the value.
    await page.click('.selective__field__text textarea[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEs)

    // Check for textareas.
    await expect(page).toMatchElement('.selective__field__text textarea[data-locale=en]')
    await expect(page).toMatchElement('.selective__field__text textarea[data-locale=es]')

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitForSelector('.editor__save--saving')
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'title': newValue,
      'title@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Text field expanded after localization save')
  })
})
