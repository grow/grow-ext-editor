const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()
const podPathsIntercept = shared.intercept.podPaths()
const routesIntercept = shared.intercept.routes()
const templatesIntercept = shared.intercept.templates()

contentIntercept.responseGet = {
  'editor': {
    'fields': []
  },
  'front_matter': {},
}

podPathsIntercept.responseGet = {
  'pod_paths': [
    '/content/pages/en.yaml',
    '/content/pages/es.yaml',
    '/content/pages/en_new.yaml',
    '/content/pages/es_new.yaml',
    '/content/pages/index.html',
    '/views/should/be/filtered.html',
  ],
}

routesIntercept.responseGet = {
  routes: {
    "/": {
      "pod_path": "/content/pages/en.yaml",
      "locale": "en_US"
    },
    "/es/": {
      "pod_path": "/content/pages/es.yaml",
      "locale": "es_US"
    },
    "/new/": {
      "pod_path": "/content/pages/en_new.yaml",
      "locale": "en_US"
    },
    "/es/new/": {
      "pod_path": "/content/pages/es_new.yaml",
      "locale": "es_US"
    },
  },
}

describe('menu drawer', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await shared.pageSetup(page, [
      contentIntercept,
      podPathsIntercept,
      routesIntercept,
      templatesIntercept,
    ])
  })

  it('should open and close with icon', async () => {
    // Open the menu.
    await page.click('.menu__hamburger')
    await page.waitForSelector('.menu__contents')

    // Close the file tree using icon.
    await page.click('.menu__site .material-icons')
    await page.waitForSelector('.menu__contents', {
      hidden: true,
    })
  })

  it('should open and close with off-menu click', async () => {
    // Open the menu.
    await page.click('.menu__hamburger')
    await page.waitForSelector('.menu__contents')

    // Close the file tree by clicking off menu.
    await page.click('.menu__repo__info')
    await page.waitForSelector('.menu__contents', {
      hidden: true,
    })
  })

  it('should show file tree', async () => {
    // Open the menu.
    await page.click('.menu__hamburger')
    await page.waitForSelector('.menu__contents')
    await page.waitForSelector('.menu__tree__tree[data-tree=file] .menu__tree__folder', {
      hidden: true,
    })

    await percySnapshot(page, 'Menu file tree collapsed.', shared.snapshotOptions)

    // Expand the file tree.
    await page.click('.menu__tree__title[data-tree=file]')
    await page.waitForSelector('.menu__tree__tree[data-tree=file] .menu__tree__folder')

    await percySnapshot(page, 'Menu file tree expanded.', shared.snapshotOptions)
  })

  it('should show new file dialog from file tree', async () => {
    // Open the menu.
    await page.click('.menu__hamburger')
    await page.waitForSelector('.menu__contents')
    await page.waitForSelector('.menu__tree__tree[data-tree=file] .menu__tree__folder', {
      hidden: true,
    })

    // Expand the file tree.
    await page.click('.menu__tree__title[data-tree=file]')
    await page.waitForSelector('.menu__tree__tree[data-tree=file] .menu__tree__folder')

    // Click the add file option.
    await page.click('.menu__tree__tree[data-tree=file] .editor__actions--add')
    await page.waitForSelector('.selective__field[data-field-full-key=fileName]')

    await percySnapshot(page, 'Menu file tree new file dialog.', shared.snapshotOptions)
  })

  it('should show sitemap tree', async () => {
    // Open the menu.
    await page.click('.menu__hamburger')
    await page.waitForSelector('.menu__contents')
    await page.waitForSelector('.menu__tree__tree[data-tree=site] .menu__tree__folder', {
      hidden: true,
    })

    await percySnapshot(page, 'Menu site tree collapsed.', shared.snapshotOptions)

    // Expand the site tree.
    await page.click('.menu__tree__title[data-tree=site]')
    await page.waitForSelector('.menu__tree__tree[data-tree=site] .menu__tree__folder')

    await percySnapshot(page, 'Menu site tree expanded.', shared.snapshotOptions)
  })
})
