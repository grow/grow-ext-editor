const defaults = require('./defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')

const newValue = 'Trombone'

describe('text field', () => {
  beforeEach(async () => {
    await page.goto('http://localhost:3000/editor.html')
    await page.setRequestInterception(true)

    page.on('request', request => {
      if (request.url().includes('/_grow/api/editor/content')) {
        console.log('Intercepted request', request.url(), request.method())
        request.respond({
          contentType: 'application/json',
          body: JSON.stringify(Object.assign({}, defaults.documentResponse, {
            'front_matter': {
              'title': (request.method() == 'POST' ? newValue : 'Trumpet')
            },
          }))
        })
      } else {
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
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Text field after save')
  })
})
