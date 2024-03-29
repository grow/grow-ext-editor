const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()
const podPathsIntercept = shared.intercept.podPaths()

const defaultEn = '/content/pages/en.yaml'
const defaultEs = '/content/pages/es.yaml'

let newValueEn = '/content/pages/en_new.yaml'
let newValueEs = '/content/pages/es_new.yaml'

contentIntercept.responseGet = {
  'editor': {
    'fields': [
      {
        'type': 'yaml',
        'key': 'data',
        'label': 'Yaml',
      },
    ]
  },
  'front_matter': {
    'data': {
      'tag': '!g.yaml',
      'value': defaultEn,
    },
    'data@es': {
      'tag': '!g.yaml',
      'value': defaultEs,
    },
  },
}

podPathsIntercept.responseGet = {
  'pod_paths': [
    '/content/pages/en.yaml',
    '/content/pages/es.yaml',
    '/content/pages/en_new.yaml',
    '/content/pages/es_new.yaml',
    '/content/should/be/filtered.html',
    '/content/should/be/filtered.md',
    '/views/should/be/filtered.html',
  ],
}

describe('yaml field', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await shared.pageSetup(page, [
      contentIntercept,
      podPathsIntercept,
    ])
  })

  it('should accept input', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Change the title.
    await page.click('.selective__field__type__yaml input', {clickCount: 3})
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
    await page.waitForTimeout(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'data': {
        'tag': '!g.yaml',
        'value': newValueEn,
      },
      'data@es': {
        'tag': '!g.yaml',
        'value': defaultEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Yaml field after save', shared.snapshotOptions)
  })

  it('should work with file list', async () => {
    // Editor starts out clean.
    let isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    // Show the file list.
    let fileListIcon = await page.$('.selective__field__type__yaml .selective__field__constructor__file_icon')
    await fileListIcon.click()
    await page.waitForSelector('.selective__file_list__file')

    await percySnapshot(page, 'Yaml field after file list load', shared.snapshotOptions)

    // Click on a file in the list.
    let listItem = await page.$(`.selective__file_list__file[data-pod-path="${newValueEn}"]`)
    await listItem.click()
    await page.waitForSelector('.selective__file_list__file', {
      hidden: true,
    })

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
      'data': {
        'tag': '!g.yaml',
        'value': newValueEn,
      },
      'data@es': {
        'tag': '!g.yaml',
        'value': defaultEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Yaml field after file list save', shared.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__yaml input[data-locale=en]')

    // Change the en title.
    await page.click('.selective__field__type__yaml input[data-locale=en]', {clickCount: 3})
    await page.keyboard.press('Backspace')
    await page.keyboard.type(newValueEn)

    // Change the es title.
    await page.click('.selective__field__type__yaml input[data-locale=es]', {clickCount: 3})
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
    await page.waitForTimeout(shared.saveWaitFor)
    await page.waitForSelector('.editor__save:not(.editor__save--saving)')

    // Verify the new value was saved.
    const value = await page.evaluate(_ => {
      return window.editorInst.selective.value
    })
    expect(value).toMatchObject({
      'data': {
        'tag': '!g.yaml',
        'value': newValueEn,
      },
      'data@es': {
        'tag': '!g.yaml',
        'value': newValueEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Yaml field after localization save', shared.snapshotOptions)
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
    await page.waitForSelector('.selective__field__type__yaml input[data-locale=en]')

    // Show the en file list.
    let fileListIcon = await page.$('.selective__field__type__yaml .selective__field__constructor__file_icon[data-locale=en]')
    await fileListIcon.click()
    await page.waitForSelector('[data-locale=en] .selective__file_list__file')

    await percySnapshot(page, 'Yaml field after file list on en localization load', shared.snapshotOptions)

    // Click on a file in the en list.
    let listItem = await page.$(`[data-locale=en] .selective__file_list__file[data-pod-path="${newValueEn}"]`)
    await listItem.click()
    await page.waitForSelector('[data-locale=en] .selective__file_list__file', {
      hidden: true,
    })

    // Show the es file list.
    fileListIcon = await page.$('.selective__field__type__yaml .selective__field__constructor__file_icon[data-locale=es]')
    await fileListIcon.click()
    await page.waitForSelector('[data-locale=es] .selective__file_list__file')

    await percySnapshot(page, 'Yaml field after file list on es localization load', shared.snapshotOptions)

    // Click on a file in the es list.
    listItem = await page.$(`[data-locale=es] .selective__file_list__file[data-pod-path="${newValueEs}"]`)
    await listItem.click()
    await page.waitForSelector('[data-locale=es] .selective__file_list__file', {
      hidden: true,
    })

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
      'data': {
        'tag': '!g.yaml',
        'value': newValueEn,
      },
      'data@es': {
        'tag': '!g.yaml',
        'value': newValueEs,
      },
    })

    // After saving the editor should be clean.
    isClean = await page.evaluate(_ => {
      return window.editorInst.isClean
    })
    expect(isClean).toBe(true)

    await percySnapshot(page, 'Yaml field after file list localization save', shared.snapshotOptions)
  })
})
