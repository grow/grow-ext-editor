const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()
const podPathsIntercept = shared.intercept.podPaths()
const staticServingPathIntercept = shared.intercept.staticServingPath()

const defaultEn = '/static/img/upload/defaultEn.png'
const defaultEs = '/static/img/upload/defaultEs.png'

const defaultMediaEn = 'http://blinkk.com/static/logo.svg'
const defaultMediaEs = 'https://avatars0.githubusercontent.com/u/5324394'

let newEn = '/static/img/upload/newEn.png'
let newEs = '/static/img/upload/newEs.png'

let newValueMediaEn = 'https://avatars0.githubusercontent.com/u/5324394'
let newValueMediaEs = 'http://blinkk.com/static/logo.svg'

const podPathToImg = {}
podPathToImg[defaultEn] = defaultMediaEn
podPathToImg[defaultEs] = defaultMediaEs
podPathToImg[newEn] = newValueMediaEn
podPathToImg[newEs] = newValueMediaEs

const defaultValueEn = {
  'url': defaultEn,
  '_meta': {
    height: 113,
    width: 300,
  },
}

const defaultValueEs = {
  'url': defaultEs,
  '_meta': {
    height: 460,
    width: 460,
  },
}

const newValueEn = {
  'url': newEn,
  '_meta': {
    height: 460,
    width: 460,
  },
}

const newValueEs = {
  'url': newEs,
  '_meta': {
    height: 113,
    width: 300,
  },
}

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'media',
        'key': 'media',
        'label': 'Media',
      },
    ]
  },
  'front_matter': {
    'media': defaultValueEn,
    'media@es': defaultValueEs,
  },
}

podPathsIntercept.responseGet = {
  'pod_paths': [
    '/content/should/be/filtered.jpg',
    defaultEn,
    defaultEs,
    newEn,
    newEs,
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

describe('media field', () => {
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
    await page.waitForSelector('.selective__media__preview__meta__size')
    await page.click('.selective__field__type__media_file input', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newEn)
    await page.waitForTimeout(shared.saveWaitFor)
    await page.waitForSelector(`img[src="${newValueMediaEn}"]`)
    await page.waitForSelector('.selective__media__preview__meta__size')

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
      'media': newValueEn,
      'media@es': defaultValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Media field after save', shared.snapshotOptions)

    await page.evaluate(_ => {
      document.querySelector('.selective__field__media_file__wrapper').classList.add(
        'selective__media--hover')
    })
    await percySnapshot(page, 'Media field hover state', shared.snapshotOptions)
  })

  it('should work with file list', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Show the file list.
    let fileListIcon = await page.$('.selective__field__type__media_file .selective__field__media_file__file_icon')
    await fileListIcon.click()
    await page.waitForSelector('.selective__file_list__file')
    await page.waitForSelector('.selective__media__preview__meta__size')

    await percySnapshot(page, 'Media field after file list load', shared.snapshotOptions)

    // Click on a file in the list.
    await page.waitForSelector('.selective__media__preview__meta__size')
    let listItem = await page.$(`.selective__file_list__file[data-pod-path="${newEn}"]`)
    await listItem.click()
    await page.waitForSelector('.selective__file_list__file', {
      hidden: true,
    })
    await page.waitForSelector(`img[src="${newValueMediaEn}"]`)
    await page.waitForSelector('.selective__media__preview__meta__size')

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
      'media': newValueEn,
      'media@es': defaultValueEs,
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Media field after file list save', shared.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__media_file input[data-locale=en]')

    // Change the en title.
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=en] .selective__media__preview__meta__size')
    await page.click('.selective__field__type__media_file input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newEn)
    await page.waitForSelector(`img[src="${newValueMediaEn}"]`)
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=en] .selective__media__preview__meta__size')

    // Change the es title.
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=es] .selective__media__preview__meta__size')
    await page.click('.selective__field__type__media_file input[data-locale=es]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newEs)
    await page.waitForSelector(`img[src="${newValueMediaEs}"]`)
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=es] .selective__media__preview__meta__size')

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
      'media': newValueEn,
      'media@es': newValueEs,
    })

    // After saving the editor should be clean.
    // TODO: Figure out why it is not clean.
    // isClean = await page.evaluate(_ => {
    //   return window.editorInst.isClean
    // })
    // expect(isClean).toBe(true)

    await percySnapshot(page, 'Media field after localization save', shared.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__media_file input[data-locale=en]')
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=en] .selective__media__preview__meta__size')
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=es] .selective__media__preview__meta__size')

    // Show the en file list.
    let fileListIcon = await page.$('.selective__field__type__media_file .selective__field__media_file__file_icon[data-locale=en]')
    await fileListIcon.click()
    await page.waitForSelector('[data-locale=en] .selective__file_list__file')
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=en] .selective__media__preview__meta__size')

    await percySnapshot(page, 'Media field after file list on en localization load', shared.snapshotOptions)

    // Click on a file in the en list.
    let listItem = await page.$(`[data-locale=en] .selective__file_list__file[data-pod-path="${newEn}"]`)
    await listItem.click()
    await page.waitForSelector('[data-locale=en] .selective__file_list__file', {
      hidden: true,
    })
    await page.waitForSelector(`img[src="${newValueMediaEn}"]`)
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=en] .selective__media__preview__meta__size')

    // Show the es file list.
    fileListIcon = await page.$('.selective__field__type__media_file .selective__field__media_file__file_icon[data-locale=es]')
    await fileListIcon.click()
    await page.waitForSelector('[data-locale=es] .selective__file_list__file')

    await percySnapshot(page, 'Media field after file list on es localization load', shared.snapshotOptions)

    // Click on a file in the es list.
    listItem = await page.$(`[data-locale=es] .selective__file_list__file[data-pod-path="${newEs}"]`)
    await listItem.click()
    await page.waitForSelector('[data-locale=es] .selective__file_list__file', {
      hidden: true,
    })
    await page.waitForSelector(`img[src="${newValueMediaEs}"]`)
    await page.waitForSelector('.selective__field__media_file__wrapper[data-locale=es] .selective__media__preview__meta__size')

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
      'media': newValueEn,
      'media@es': newValueEs,
    })

    // After saving the editor should be clean.
    // TODO: Figure out why it is not clean.
    // isClean = await page.evaluate(_ => {
    //   return window.editorInst.isClean
    // })
    // expect(isClean).toBe(true)

    await percySnapshot(page, 'Media field after file list localization save', shared.snapshotOptions)
  })
})
