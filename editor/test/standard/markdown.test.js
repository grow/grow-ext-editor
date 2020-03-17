const defaults = require('../defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const editorConfig = {
  'fields': [
    {
      'type': 'markdown',
      'key': 'content',
      'label': 'Content',
    }
  ]
}
const defaultEn = '# But why is the toilet paper gone?'
const defaultEs = '# ¿Pero por qué se fue el papel higiénico?'
let newValueEn = '# Toilet paper is the new gold currency.'
let newValueEs = '# El papel higiénico es la nueva moneda de oro.'
let newValueTypeEn = 'Toilet paper is the new gold currency.'
let newValueTypeEs = 'El papel higiénico es la nueva moneda de oro.'

describe('markdown field', () => {
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
              'editor': editorConfig,
            }))
          })
        } else {
          request.respond({
            contentType: 'application/json',
            body: JSON.stringify(Object.assign({}, defaults.documentResponse, {
              'front_matter': {
                'content': defaultEn,
                'content@es': defaultEs,
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
    await page.waitForSelector('.selective__fields')
  })

  it('should accept input', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Change the title.
    await page.click('.selective__field__markdown .pell-content', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueTypeEn)

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
      'content': newValueEn,
      'content@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Markdown field after save', defaults.snapshotOptions)
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
    await page.waitForSelector('.selective__field__markdown .pell[data-locale=en] .pell-content')

    // // Change the en title.
    // await page.click('.selective__field__markdown .pell[data-locale=en] .pell-content', {clickCount: 3})
    // await page.keyboard.press('Backspace')
    // await page.keyboard.type(newValueTypeEn)
    //
    // // Change the es title.
    // await page.click('.selective__field__markdown .pell[data-locale=es] .pell-content', {clickCount: 3})
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
    // await page.waitForSelector('.editor__save--saving')
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
    //
    // // After saving the editor should be clean.
    // isClean = await page.evaluate(_ => {
    //   return window.editorInst.isClean
    // })
    // expect(isClean).toBe(true)
    //
    // await percySnapshot(page, 'Markdown field after localization save', defaults.snapshotOptions)
  })
})
