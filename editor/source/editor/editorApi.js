/**
 * Utility for working with apis.
 */

import Api from '../utility/api'
import Defer from '../utility/defer'

export default class EditorApi extends Api {
  constructor(config) {
    super(config)
  }

  getDocument(podPath) {
    const result = new Defer()

    this.request.get(this.apiPath('content'))
      .query({ 'pod_path': podPath })
      .then((res) => {
        result.resolve(res.body)
      })

    return result.promise
  }

  getDocuments(podPath) {
    const result = new Defer()

    this.request.get(this.apiPath('documents'))
      .then((res) => {
        result.resolve(res.body)
      })

    return result.promise
  }

  getPartials(podPath) {
    const result = new Defer()

    this.request.get(this.apiPath('partials'))
      .then((res) => {
        result.resolve(res.body)
      })

    return result.promise
  }

  getPodPaths() {
    const result = new Defer()

    this.request.get(this.apiPath('pod_paths'))
      .then((res) => {
        result.resolve(res.body)
      })

    return result.promise
  }

  saveDocumentFields(podPath, frontMatter, locale, content) {
    const result = new Defer()
    const saveRequest = {
      'pod_path': podPath,
      'front_matter': JSON.stringify(frontMatter),
      'locale': locale,
      'content': content,
    }

    this.request.post(this.apiPath('content'))
      .type('form')
      .send(saveRequest)
      .then((res) => {
        result.resolve(res.body)
      })

    return result.promise
  }

  saveDocumentSource(podPath, rawFrontMatter) {
    const result = new Defer()
    const saveRequest = {
      'pod_path': podPath,
      'raw_front_matter': rawFrontMatter,
    }

    this.request.post(this.apiPath('content'))
      .type('form')
      .send(saveRequest)
      .then((res) => {
        result.resolve(res.body)
      })

    return result.promise
  }
}
