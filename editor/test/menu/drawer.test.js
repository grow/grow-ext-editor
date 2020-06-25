const shared = require('../shared')
const { percySnapshot } = require('@percy/puppeteer')
const path = require('path')
const qs = require('querystring')

const contentIntercept = shared.intercept.content()

contentIntercept.responseGet = {
  'editor': {
    'fields': []
  },
  'front_matter': {},
}

describe('menu drawer', () => {
  beforeEach(async () => {
    // Need a new page to prevent requests already being handled.
    page = await browser.newPage()
    await shared.pageSetup(page, [
      contentIntercept,
    ])
  })

  it('should open when clicked', async () => {
    await percySnapshot(page, 'Menu closed', shared.snapshotOptions)

    // Change the title.
    await page.click('.menu__hamburger')
    await page.waitForSelector('.menu__contents')

    await percySnapshot(page, 'Menu opened', shared.snapshotOptions)
  })
})
