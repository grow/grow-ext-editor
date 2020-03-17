const defaults = require('../defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const editorConfig = {
  'fields': [
    {
      'type': 'document',
      'key': 'doc',
      'label': 'Document',
    }
  ]
}
const defaultEn = '/content/pages/en.yaml'
const defaultEs = '/content/pages/es.yaml'
let newValueEn = '/content/pages/en_new.yaml'
let newValueEs = '/content/pages/es_new.yaml'

describe('document field', () => {
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
                'doc': {
                  'tag': '!g.doc',
                  'value': defaultEn,
                },
                'doc@es': {
                  'tag': '!g.doc',
                  'value': defaultEs,
                },
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
    await page.click('.selective__field__document input', {clickCount: 3})
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
    await page.waitForSelector('.editor__save--saving')
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'doc': {
        'tag': '!g.doc',
        'value': newValueEn,
      },
      'doc@es': {
        'tag': '!g.doc',
        'value': defaultEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Document field after save', defaults.snapshotOptions)
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
    await page.waitForSelector('.selective__field__document input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__document input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEn)

    // Change the es title.
    await page.click('.selective__field__document input[data-locale=es]', {clickCount: 3})
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
      'doc': {
        'tag': '!g.doc',
        'value': newValueEn,
      },
      'doc@es': {
        'tag': '!g.doc',
        'value': newValueEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Document field after localization save', defaults.snapshotOptions)
  })
})
