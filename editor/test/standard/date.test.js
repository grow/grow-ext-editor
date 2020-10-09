const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()

const defaultEn = '2020-03-01'
const defaultEs = '2022-05-03'

let newValueEn = '2021-04-02'
let newValueEs = '2020-07-25'

// Format the typing for the order that the field shows in en_US.
let newValueTypeEn = '04-02-2021'
let newValueTypeEs = '07-25-2020'

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'date',
        'key': 'published',
        'label': 'Published',
      },
    ]
  },
  'front_matter': {
    'published': defaultEn,
    'published@es': defaultEs,
  },
}

describe('date field', () => {
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

    // Change the title.
    await page.click('.selective__field__type__date input', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueTypeEn.replace('-', ''))

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitForTimeout(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'published': newValueEn,
      'published@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Date field after save', shared.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__date input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__type__date input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueTypeEn.replace('-', ''))

    // Change the es title.
    await page.click('.selective__field__type__date input[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueTypeEs.replace('-', ''))

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitForTimeout(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'published': newValueEn,
      'published@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Date field after localization save', shared.snapshotOptions)
  })
})
