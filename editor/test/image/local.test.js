const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()
const podPathsIntercept = shared.intercept.podPaths()
const staticServingPathIntercept = shared.intercept.staticServingPath()

const defaultEn = '/static/img/upload/defaultEn.png'
const defaultEs = '/static/img/upload/defaultEs.png'

const defaultImageEn = 'http://blinkk.com/static/logo.svg'
const defaultImageEs = 'https://avatars0.githubusercontent.com/u/5324394'

let newValueEn = '/static/img/upload/newValueEn.png'
let newValueEs = '/static/img/upload/newValueEs.png'

let newValueImageEn = 'https://avatars0.githubusercontent.com/u/5324394'
let newValueImageEs = 'http://blinkk.com/static/logo.svg'

const podPathToImg = {}
podPathToImg[defaultEn] = defaultImageEn
podPathToImg[defaultEs] = defaultImageEs
podPathToImg[newValueEn] = newValueImageEn
podPathToImg[newValueEs] = newValueImageEs

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'image',
        'key': 'image',
        'label': 'Image',
      },
    ]
  },
  'front_matter': {
    'image': defaultEn,
    'image@es': defaultEs,
  },
}

podPathsIntercept.responseGet = {
  'pod_paths': [
    '/content/should/be/filtered.jpg',
    defaultEn,
    defaultEs,
    newValueEn,
    newValueEs,
    '/views/should/be/filtered.png',
  ],
}

staticServingPathIntercept.callbackGet = (request) => {
  const params = (new URL(request.url())).searchParams
  const podPath = params.get('pod_path')
  return {
    'pod_path': podPath,
    'serving_url': podPathToImg[podPath],
  }
}

describe('image field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await shared.pageSetup(page, [
      contentIntercept,
      podPathsIntercept,
      staticServingPathIntercept,
    ])
  })

  it('should accept input', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Change the title.
    await page.click('.selective__field__type__image_file input', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEn)
    await page.waitForSelector('.selective__image__preview__meta')

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'image': newValueEn,
      'image@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Image field after save', shared.snapshotOptions)

    await page.evaluate(_ => {
      document.querySelector('.selective__field__image_file__wrapper').classList.add(
        'selective__image--hover')
    })
    await percySnapshot(page, 'Image field hover state', shared.snapshotOptions)
  })

  it('should work with file list', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Show the file list.
    let fileListIcon = await page.$('.selective__field__type__image_file .selective__field__image_file__file_icon')
    await fileListIcon.click()
    await page.waitForSelector('.selective__file_list__file')
    await page.waitForSelector('.selective__image__preview__meta__size')

    await percySnapshot(page, 'Image field after file list load', shared.snapshotOptions)

    // Click on a file in the list.
    let listItem = await page.$(`.selective__file_list__file[data-pod-path="${newValueEn}"]`)
    await listItem.click()
    await page.waitForSelector('.selective__file_list__file', {
      hidden: true,
    })
    await page.waitForSelector('.selective__image__preview__meta')

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'image': newValueEn,
      'image@es': defaultEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Image field after file list save', shared.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__image_file input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__type__image_file input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEn)
    await page.waitForSelector('.selective__field__image_file__wrapper[data-locale=en] .selective__image__preview__meta')

    // Change the es title.
    await page.click('.selective__field__type__image_file input[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEs)
    await page.waitForSelector('.selective__field__image_file__wrapper[data-locale=es] .selective__image__preview__meta')

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'image': newValueEn,
      'image@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Image field after localization save', shared.snapshotOptions)
  })

  it('should work with file list on localization', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Enable localization.
    const localizationIcon = await page.$('i[title="Localize content"]')
    await localizationIcon.click()
    await page.waitForSelector('.selective__field__type__image_file input[data-locale=en]')
    await page.waitForSelector('.selective__field__image_file__wrapper[data-locale=en] .selective__image__preview__meta')
    await page.waitForSelector('.selective__field__image_file__wrapper[data-locale=es] .selective__image__preview__meta')

    // Show the en file list.
    let fileListIcon = await page.$('.selective__field__type__image_file .selective__field__image_file__file_icon[data-locale=en]')
    await fileListIcon.click()
    await page.waitForSelector('[data-locale=en] .selective__file_list__file')
    await page.waitForSelector('.selective__field__image_file__wrapper[data-locale=en] .selective__image__preview__meta')

    await percySnapshot(page, 'Image field after file list on en localization load', shared.snapshotOptions)

    // Click on a file in the en list.
    let listItem = await page.$(`[data-locale=en] .selective__file_list__file[data-pod-path="${newValueEn}"]`)
    await listItem.click()
    await page.waitForSelector('[data-locale=en] .selective__file_list__file', {
      hidden: true,
    })
    await page.waitForSelector('.selective__field__image_file__wrapper[data-locale=en] .selective__image__preview__meta')

    // Show the es file list.
    fileListIcon = await page.$('.selective__field__type__image_file .selective__field__image_file__file_icon[data-locale=es]')
    await fileListIcon.click()
    await page.waitForSelector('[data-locale=es] .selective__file_list__file')

    await percySnapshot(page, 'Image field after file list on es localization load', shared.snapshotOptions)

    // Click on a file in the es list.
    listItem = await page.$(`[data-locale=es] .selective__file_list__file[data-pod-path="${newValueEs}"]`)
    await listItem.click()
    await page.waitForSelector('[data-locale=es] .selective__file_list__file', {
      hidden: true,
    })
    await page.waitForSelector('.selective__field__image_file__wrapper[data-locale=es] .selective__image__preview__meta')

    // Editor should now be dirty.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(false)

    // Save the changes.
    const saveButton = await page.$('.editor__save')
    await saveButton.click()
    await page.waitFor(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'image': newValueEn,
      'image@es': newValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Image field after file list localization save', shared.snapshotOptions)
  })
})
