const defaults = require('../defaults')
const intercept = require('../intercept')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = new intercept.ContentIntercept(
  '/_grow/api/editor/content')

const defaultEn = '<p>But why is the toilet paper gone?</p>'
const defaultEs = '<p>¿Pero por qué se fue el papel higiénico?</p>'

let newValueEn = '<p>Toilet paper is the new gold currency.</p>'
let newValueEs = '<p>El papel higiénico es la nueva moneda de oro.</p>'

let newValueTypeEn = 'Toilet paper is the new gold currency.'
let newValueTypeEs = 'El papel higiénico es la nueva moneda de oro.'

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'html',
        'key': 'content',
        'label': 'Content',
      },
    ]
  },
  'front_matter': {
    'content': defaultEn,
    'content@es': defaultEs,
  },
}

describe('html field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await page.goto('http://localhost:3000/editor.html')
    await page.setRequestInterception(true)

    page.on('request', request => {
      if (contentIntercept.processRequest(request)) {
        // Intercepted.
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

  it('should accept input', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // TODO: Get working with the editor.
    // // Change the title.
    // await page.click('.selective__field__type__html .tui-editor-contents', {clickCount: 3})
    // await page.keyboard.press('Backspace')
    // await page.keyboard.type(newValueTypeEn)
    //
    // // Editor should now be dirty.
    // isClean = await page.evaluate(_ => {
    //   return window.editorInst.isClean
    // })
    // expect(isClean).toBe(false)
    //
    // // Save the changes.
    // const saveButton = await page.$('.editor__save')
    // await saveButton.click()
    // await page.waitFor(defaults.saveWaitFor)
    // await page.waitForSelector('.editor__save:not(.editor__save--saving)')
    //
    // // Verify the new value was saved.
    // const value = await page.evaluate(_ => {
    //   return window.editorInst.selective.value
    // })
    // expect(value).toMatchObject({
    //   'content': newValueEn,
    //   'content@es': defaultEs,
    // })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Html field after save', defaults.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__html [data-locale=en]')

    // TODO: Get working with the editor.
    // // Change the en title.
    // await page.click('.selective__field__type__html [data-locale=en] .tui-editor-contents', {clickCount: 3})
    // await page.keyboard.press('Backspace')
    // await page.keyboard.type(newValueTypeEn)
    //
    // // Change the es title.
    // await page.click('.selective__field__type__html [data-locale=es] .tui-editor-contents', {clickCount: 3})
    // await page.keyboard.press('Backspace')
    // await page.keyboard.type(newValueTypeEs)
    //
    // // Editor should now be dirty.
    // isClean = await page.evaluate(_ => {
    //   return window.editorInst.isClean
    // })
    // expect(isClean).toBe(false)
    //
    // // Save the changes.
    // const saveButton = await page.$('.editor__save')
    // await saveButton.click()
    // await page.waitFor(defaults.saveWaitFor)
    // await page.waitForSelector('.editor__save:not(.editor__save--saving)')
    //
    // // Verify the new value was saved.
    // const value = await page.evaluate(_ => {
    //   return window.editorInst.selective.value
    // })
    // expect(value).toMatchObject({
    //   'content': newValueEn,
    //   'content@es': newValueEs,
    // })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Html field after localization save', defaults.snapshotOptions)
  })
})
