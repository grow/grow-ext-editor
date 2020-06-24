const defaults = require('../defaults')
const utility = require('../utility')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const podIntercept = defaults.intercept.pod()
const contentIntercept = defaults.intercept.content()

const defaultEn = 'Trumpet'
const defaultEs = 'Trompeta'

let newValueEn = 'Trombone'
let newValueEs = 'Trombón'

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'list',
        'key': 'list',
        'label': 'List (simple)',
        'fields': [
          {
            'type': 'text',
          }
        ],
      },
    ]
  },
  'front_matter': {
    'list': [
      defaultEn,
      newValueEn,
    ],
    'list@es': [
      defaultEs,
      newValueEs,
    ],
  },
}

describe('list simple field sorting', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await page.goto('http://localhost:3000/editor.html')
    await page.setRequestInterception(true)

    page.on('request', request => {
      if (contentIntercept.processRequest(request)) {
        // Intercepted.
      } else if (podIntercept.processRequest(request)) {
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

  it('should allow reordering values', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Get the uid for the field to wait for it change pos after sorting.
    let firstInputIdEn = await page.evaluate(_ => {
      return document.querySelector('.selective__list__item:first-child input').id
    })

    // Sort the values.
    await page.waitForSelector(`.selective__list__item:first-child input[id="${firstInputIdEn}"]`)
    await utility.dragAndDrop(
      page,
      '.selective__list__item:first-child .selective__list__item__drag',
      '.selective__list__item:last-child .selective__list__item__drag',
      'List field simple mid-sort')
    // TODO: Doesn't correctly sort.
    // See https://github.com/puppeteer/puppeteer/issues/1376
    // await page.waitForSelector(`.selective__list__item:last-child input[id="${firstInputIdEn}"]`)
    //
    // firstInputIdEn = await page.evaluate(_ => {
    //   return document.querySelector('.selective__list__item:first-child input').id
    // })
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
    //   'list': [
    //     newValueEn,
    //     defaultEn,
    //   ],
    //   'list@es': [
    //     newValueEs,
    //     defaultEs,
    //   ],
    // })
    //
    // // After saving the editor should be clean.
    // isClean = await page.evaluate(_ => {
    //   return window.editorInst.isClean
    // })
    // expect(isClean).toBe(true)
    //
    // await percySnapshot(page, 'List field simple sorted after save', defaults.snapshotOptions)
  })

  // it('should accept input on localization', async () => {
  //   // Editor starts out clean.
  //   let isClean = await page.evaluate(_ => {
  //     return window.editorInst.isClean
  //   })
  //   expect(isClean).toBe(true)
  //
  //   // Enable localization.
  //   const localizationIcon = await page.$('i[title="Localize content"]')
  //   await localizationIcon.click()
  //   await page.waitForSelector('.selective__field__type__text input[data-locale=en]')
  //
  //   // Change the en value.
  //   await page.click('.selective__list__item[data-locale=en] .selective__field__type__text input[data-locale=en]', {clickCount: 3})
  //   await page.keyboard.press('Backspace')
  //   await page.keyboard.type(newValueEn)
  //
  //   // Change the es value.
  //   await page.click('.selective__list__item[data-locale=es] .selective__field__type__text input[data-locale=en]', {clickCount: 3})
  //   await page.keyboard.press('Backspace')
  //   await page.keyboard.type(newValueEs)
  //
  //   // Editor should now be dirty.
  //   isClean = await page.evaluate(_ => {
  //     return window.editorInst.isClean
  //   })
  //   expect(isClean).toBe(false)
  //
  //   // Save the changes.
  //   const saveButton = await page.$('.editor__save')
  //   await saveButton.click()
  //   await page.waitFor(defaults.saveWaitFor)
  //   await page.waitForSelector('.editor__save:not(.editor__save--saving)')
  //
  //   // Verify the new value was saved.
  //   const value = await page.evaluate(_ => {
  //     return window.editorInst.selective.value
  //   })
  //   expect(value).toMatchObject({
  //     'list': [
  //       newValueEn,
  //     ],
  //     'list@es': [
  //       newValueEs,
  //     ],
  //   })
  //
  //   // After saving the editor should be clean.
  //   isClean = await page.evaluate(_ => {
  //     return window.editorInst.isClean
  //   })
  //   expect(isClean).toBe(true)
  //
  //   await percySnapshot(page, 'List field simple after localization save', defaults.snapshotOptions)
  // })
})
