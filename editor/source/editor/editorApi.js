/**
 * Utility for working with apis.
 */

import Api from '../utility/api'
import Defer from '../utility/defer'

export default class EditorApi extends Api {
  constructor(config) {
    super(config)
  }

  copyFile(podPath, newPodPath) {
    const result = new Defer()

    this.request.get(this.apiPath('content/copy'))
      .query({ 'pod_path': podPath, 'new_pod_path': newPodPath })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  createWorkspace(base, workspace, remote) {
    const result = new Defer()

    const request = {
      'base': base,
      'workspace': workspace,
      'remote': remote || 'origin',
    }

    this.request.post(this.apiPath('workspace/new'))
      .type('form')
      .send(request)
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  deleteFile(podPath) {
    const result = new Defer()

    this.request.get(this.apiPath('content/delete'))
      .query({ 'pod_path': podPath })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getDocument(podPath) {
    const result = new Defer()

    this.request.get(this.apiPath('content'))
      .query({ 'pod_path': podPath })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getExtensionConfig(extension_path) {
    const result = new Defer()

    this.request.get(this.apiPath('extension/config'))
      .query({ 'extension_path': extension_path })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getRoutes() {
    const result = new Defer()

    this.request.get(this.apiPath('routes'))
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getPartials() {
    const result = new Defer()

    this.request.get(this.apiPath('partials'))
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getPod() {
    const result = new Defer()

    this.request.get(this.apiPath('pod'))
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getPodPaths() {
    const result = new Defer()

    this.request.get(this.apiPath('pod_paths'))
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getRepo() {
    const result = new Defer()

    this.request.get(this.apiPath('repo'))
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getStaticServingPath(podPath) {
    const result = new Defer()

    this.request.get(this.apiPath('static_serving_path'))
      .query({ 'pod_path': podPath })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getStrings() {
    const result = new Defer()

    this.request.get(this.apiPath('strings'))
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  getTemplates() {
    const result = new Defer()

    this.request.get(this.apiPath('templates'))
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
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
      .catch((err) => {
        result.reject(err)
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
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  // TODO: Move to the google image extension.
  saveGoogleImage(imageFile, uploadUrl) {
    const result = new Defer()
    const formData  = new FormData()
    formData.append('file', imageFile)

    this.request.post(uploadUrl)
      .send(formData)
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  saveImage(imageFile, destination) {
    const result = new Defer()
    const formData  = new FormData()
    formData.append('file', imageFile)
    formData.append('destination', destination)

    this.request.post(this.apiPath('image'))
      .send(formData)
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  screenshotPartial(partial, key) {
    const result = new Defer()

    this.request.get(this.apiPath('screenshot/partial'))
      .query({
        'partial': partial,
        'key': key,
       })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  screenshotTemplate(collectionPath, key) {
    const result = new Defer()

    this.request.get(this.apiPath('screenshot/template'))
      .query({
        'collection_path': collectionPath,
        'key': key,
       })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }

  templateFile(collectionPath, key, fileName) {
    const result = new Defer()

    this.request.get(this.apiPath('content/template'))
      .query({
        'collection_path': collectionPath,
        'file_name': fileName,
        'key': key,
      })
      .then((res) => {
        result.resolve(res.body)
      })
      .catch((err) => {
        result.reject(err)
      })

    return result.promise
  }
}
