const defaults = require('../defaults')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const podIntercept = defaults.intercept.pod()
const repoIntercept = defaults.intercept.repo()
const contentIntercept = defaults.intercept.content()

const defaultEn = ''
const defaultEs = ''

// Format the typing for the order that the field shows in en_US.
let newDateTypeEn = '04-02-2021'
let newDateTypeEs = '07-25-2020'

let newTimeTypeEn = '02-05p'
let newTimeTypeEs = '05-18a'

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'datetime',
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

let newValueEn = '2021-04-02T14:05'
let newValueEs = '2020-07-25T05:18'

describe('datetime field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', defaults.interceptRequest([
      contentIntercept,
      podIntercept,
      repoIntercept,
    ]))

    await page.goto('http://localhost:3000/editor.html')
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

    // Change the title.
    await page.click('.selective__field__type__datetime input')
    await page.keyboard.type(newDateTypeEn.replace('-', ''))
    await page.keyboard.press('Tab')
    await page.keyboard.type(newTimeTypeEn.replace('-', ''))

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
      'published': newValueEn,
      'published@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Datetime field after save', defaults.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__datetime input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__type__datetime input[data-locale=en]')
    await page.keyboard.type(newDateTypeEn.replace('-', ''))
    await page.keyboard.press('Tab')
    await page.keyboard.type(newTimeTypeEn.replace('-', ''))

    // Change the es title.
    await page.click('.selective__field__type__datetime input[data-locale=es]')
    await page.keyboard.type(newDateTypeEs.replace('-', ''))
    await page.keyboard.press('Tab')
    await page.keyboard.type(newTimeTypeEs.replace('-', ''))

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
      'published': newValueEn,
      'published@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Datetime field after localization save', defaults.snapshotOptions)
  })
})
