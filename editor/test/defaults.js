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

const staticServingPathIntercept = () => {
  const interceptObj = new intercept.JsonIntercept(
    '/_grow/api/editor/static_serving_path')
  return interceptObj
}

module.exports = {
  intercept: {
    content: contentIntercept,
    pod: podIntercept,
    podPaths: podPathsIntercept,
    staticServingPath: staticServingPathIntercept,
  },
  saveWaitFor: 100,
  snapshotOptions: {
    widths: [1280],
  },
}
