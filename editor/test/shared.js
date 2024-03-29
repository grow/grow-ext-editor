const intercept = require('./intercept')

const contentIntercept = () => {
  const interceptObj = new intercept.ContentIntercept(
    '/_grow/api/editor/content')
  return interceptObj
}

const podIntercept = () => {
  const interceptObj = new intercept.JsonIntercept(
    '/_grow/api/editor/pod')
  interceptObj.responseGet = {
    pod: {
      title: 'Test Pod',
    },
  }
  return interceptObj
}

const podPathsIntercept = () => {
  const interceptObj = new intercept.JsonIntercept(
    '/_grow/api/editor/pod_paths')
  return interceptObj
}

const repoIntercept = () => {
  const interceptObj = new intercept.JsonIntercept(
    '/_grow/api/editor/repo')

  // Use relative dates to allow nice date comparison.
  // EX: 2 days ago
  const commitDate1 = new Date()
  commitDate1.setDate(commitDate1.getDate() - 3)
  const commitDate2 = new Date()
  commitDate2.setDate(commitDate2.getDate() - 2)
  const commitDate3 = new Date()
  commitDate3.setDate(commitDate3.getDate() - 1)
  const tsLength = '2020-06-23T20:39:57'.length

  interceptObj.responseGet = {
    repo: {
      web_url: "https://www.github.com/grow/grow-ext-editor",
      remote_url: "git@github.com:grow/grow-ext-editor.git",
      revision: "126",
      branch: "master",
      commits: [
        {
          message: "Test commit 3",
          commit_date: commitDate3.toISOString().slice(0, tsLength),
          sha: "9aebd1307077aecf024c9b2ca56587b26cf67143",
          author: {
            name: "Author Name",
            email: "author@example.com"
          }
        },
        {
          message: "Test commit 2",
          commit_date: commitDate2.toISOString().slice(0, tsLength),
          sha: "0187226478d3bd094ec9379b74469b3b71303cb3",
          author: {
            name: "Author Name",
            email: "author@example.com"
          }
        },
        {
          message: "Test commit 1",
          commit_date: commitDate1.toISOString().slice(0, tsLength),
          sha: "8b78a0bf28076ce6ddc795b9ca528b5029c8d027",
          author: {
            name: "Author Name",
            email: "author@example.com"
          }
        },
      ],
    },
  }
  return interceptObj
}

const routesIntercept = () => {
  const interceptObj = new intercept.JsonIntercept(
    '/_grow/api/editor/routes')
  return interceptObj
}

const staticServingPathIntercept = () => {
  const interceptObj = new intercept.JsonIntercept(
    '/_grow/api/editor/static_serving_path')
  return interceptObj
}

const templatesIntercept = () => {
  const interceptObj = new intercept.JsonIntercept(
    '/_grow/api/editor/templates')
  interceptObj.responseGet = {
    templates: {},
  }
  return interceptObj
}

const pageSetup = async (page, interceptors) => {
  // Add global interceptors.
  // Can be overridden by interceptors since it is first come first served.
  interceptors.push(podIntercept())
  interceptors.push(repoIntercept())

  // Add error listeners to show errors.
  page.on('error', err=> {
    console.log('Page error: ', err)
  })
  page.on('pageerror', pageerr=> {
    console.log('Error: ', pageerr)
  })

  await page.setRequestInterception(true)
  page.on('request', intercept.interceptRequest(interceptors))
  await page.goto('http://localhost:3000/editor.html')
  await page.evaluate(_ => {
    window.editorInst = new Editor(document.querySelector('.container'), {
      'testing': true,
    })
  })
  await page.waitForSelector('.selective')
}

module.exports = {
  intercept: {
    content: contentIntercept,
    pod: podIntercept,
    podPaths: podPathsIntercept,
    repo: repoIntercept,
    routes: routesIntercept,
    staticServingPath: staticServingPathIntercept,
    templates: templatesIntercept,
  },
  interceptRequest: intercept.interceptRequest,
  pageSetup: pageSetup,
  saveWaitFor: 250,
  imageMetaWaitFor: 2000,
  snapshotOptions: {
    widths: [1280],
  },
}
