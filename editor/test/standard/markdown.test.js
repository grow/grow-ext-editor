const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()

const defaultEn = '# But why is the toilet paper gone?'
const defaultEs = '# ¿Pero por qué se fue el papel higiénico?'

let newValueEn = '# Toilet paper is the new gold currency.'
let newValueEs = '# El papel higiénico es la nueva moneda de oro.'

let newValueTypeEn = 'Toilet paper is the new gold currency.'
let newValueTypeEs = 'El papel higiénico es la nueva moneda de oro.'

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'markdown',
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

describe('markdown field', () => {
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

    await page.waitForSelector('.selective__field__type__markdown')

    // TODO: Get working with the editor.
    // // Change the title.
    // await page.click('.selective__field__type__markdown .cm-header', {clickCount: 3})
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
    // await page.waitForTimeout(shared.saveWaitFor)
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

    await percySnapshot(page, 'Markdown field after save', shared.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__markdown [data-locale=en]')

    // TODO: Get working with the editor.
    // // Change the en title.
    // await page.click('.selective__field__type__markdown [data-locale=en] .cm-header', {clickCount: 3})
    // await page.keyboard.press('Backspace')
    // await page.keyboard.type(newValueTypeEn)
    //
    // // Change the es title.
    // await page.click('.selective__field__type__markdown [data-locale=es] .cm-header', {clickCount: 3})
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
    // await page.waitForTimeout(shared.saveWaitFor)
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

    await percySnapshot(page, 'Markdown field after localization save', shared.snapshotOptions)
  })
})
