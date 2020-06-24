// Utility for working with intercept requests.

const qs = require('querystring')


class BaseIntercept {
  constructor(urlPart) {
    this.urlPart = urlPart
    this._callbacks = {
      get: null,
      head: null,
      post: null,
    }
    this._responses = {
      get: null,
      head: null,
      post: null,
    }
  }

  get callbackGet() {
    return this._callbacks.get
  }

  get callbackHead() {
    return this._callbacks.head
  }

  get callbackPost() {
    return this._callbacks.post
  }

  get responseGet() {
    return this._responses.get
  }

  get responseHead() {
    return this._responses.head
  }

  get responsePost() {
    return this._responses.post
  }

  set callbackGet(value) {
    this._callbacks.get = value
  }

  set callbackHead(value) {
    this._callbacks.head = value
  }

  set callbackPost(value) {
    this._callbacks.post = value
  }

  set responseGet(value) {
    this._responses.get = value
  }

  set responseHead(value) {
    this._responses.head = value
  }

  set responsePost(value) {
    this._responses.post = value
  }

  dataGet(request) {
    return this.responseGet
  }

  dataHead(request) {
    return this.responseHead
  }

  dataPost(request) {
    return this.responsePost
  }

  handleGet(request) {
    return false
  }

  handleHead(request) {
    return false
  }

  handlePost(request) {
    return false
  }

  processRequest(request) {
    if (request.url().includes(this.urlPart)) {
      if (request.method() == 'POST') {
        if (this.handlePost(request)) {
          return true
        }
      } else if (request.method() == 'HEAD') {
        if (this.handleHead(request)) {
          return true
        }
      } else if (request.method() == 'GET') {
        if (this.handleGet(request)) {
          return true
        }
      }
    }
    return false
  }
}

class JsonIntercept extends BaseIntercept {
  constructor(urlPart) {
    super(urlPart)
  }

  handleGet(request) {
    let data = null
    if (this.callbackGet) {
      data = this.callbackGet(request)
    } else {
      data = this.dataGet(request)
    }

    if (data) {
      request.respond({
        contentType: 'application/json',
        body: JSON.stringify(data),
      })
      return true
    }
    return false
  }

  handleHead(request) {
    let data = null
    if (this.callbackHead) {
      data = this.callbackHead(request)
    } else {
      data = this.dataHead(request)
    }

    if (data) {
      request.respond({
        contentType: 'application/json',
        body: JSON.stringify(data),
      })
      return true
    }
    return false
  }

  handlePost(request) {
    let data = null
    if (this.callbackPost) {
      data = this.callbackPost(request)
    } else {
      data = this.dataPost(request)
    }

    if (data) {
      request.respond({
        contentType: 'application/json',
        body: JSON.stringify(data),
      })
      return true
    }
    return false
  }
}

class ContentIntercept extends JsonIntercept {
  constructor(urlPart) {
    super(urlPart)

    this._defaultResponse = {
      'raw_front_matter': '',
      'front_matter': {},
      'default_locale': 'en',
      'locales': ['en', 'es'],
      'serving_paths': {
        'en': '/',
        'es': '/es/',
      },
      'pod_path': '/content/test/test.yaml',
      'editor': {}
    }
  }

  dataGet(request) {
    return Object.assign({}, this._defaultResponse, this.responseGet)
  }

  dataPost(request) {
    // Respond to posts with the same front matter.
    const postData = qs.parse(request.postData())
    const frontMatter = JSON.parse(postData.front_matter)
    return Object.assign({}, this._defaultResponse, this.responsePost, {
      'front_matter': frontMatter,
    })
  }
}

module.exports = {
  ContentIntercept: ContentIntercept,
  JsonIntercept: JsonIntercept,
}
