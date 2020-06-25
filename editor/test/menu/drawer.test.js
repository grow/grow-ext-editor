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
