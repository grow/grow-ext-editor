const defaults = require('../defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const editorConfig = {
  'fields': [
    {
      'type': 'variant',
      'key': 'variant',
      'label': 'Variant test',
      'variants': {
        'test1': {
          'label': 'Test 1',
          'fields': [
            {
              'type': 'text',
              'key': 'title',
              'label': 'Title 1',
            }
          ],
        },
        'test2': {
          'label': 'Test 2',
          'fields': [
            {
              'type': 'textarea',
              'key': 'title',
              'label': 'Title 2',
            }
          ],
        },
      }
    }
  ]
}
const defaultEn = 'Trumpet'
const defaultEs = 'Trompeta'
let newValueEn = 'Trombone'
let newValueEs = 'Trombón'

describe('variant field', () => {
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
                'variant': {
                  'title': defaultEn,
                  'title@es': defaultEs,
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
    await page.waitForSelector('.selective')
  })

  it('should accept input', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Variant field with no selection', defaults.snapshotOptions)

    // Select the first variant.
    const variantButton1 = await page.$('.selective__variant__variant[data-variant=test1]')
    await variantButton1.click()
    await page.waitForSelector('.selective__field__type__text input')

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
    await page.waitFor(defaults.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'variant': {
        'title': newValueEn,
        'title@es': defaultEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Variant field after save', defaults.snapshotOptions)

    // Select the second variant.
    const variantButton2 = await page.$('.selective__variant__variant[data-variant=test2]')
    await variantButton2.click()
    await page.waitForSelector('.selective__field__type__textarea textarea')

    await percySnapshot(page, 'Variant field after variant switch', defaults.snapshotOptions)
  })

  it('should accept input on localization', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Variant field localization with no selection', defaults.snapshotOptions)

    // Select the first variant.
    const variantButton1 = await page.$('.selective__variant__variant[data-variant=test1]')
    await variantButton1.click()
    await page.waitForSelector('.selective__field__type__text input')

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
    await page.waitFor(defaults.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'variant': {
        'title': newValueEn,
        'title@es': newValueEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Variant field after localization save', defaults.snapshotOptions)

    // Select the second variant.
    const variantButton2 = await page.$('.selective__variant__variant[data-variant=test2]')
    await variantButton2.click()
    await page.waitForSelector('.selective__field__type__textarea textarea')

    await percySnapshot(page, 'Variant field after variant localization switch', defaults.snapshotOptions)
  })
})
