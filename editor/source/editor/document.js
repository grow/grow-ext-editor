/**
 * Document for the editor.
 */

import { autoDeepObject } from '../utility/deepObject'

export default class Document {
  constructor(podPath, frontMatter, rawFrontMatter, servingPaths, defaultLocale, locales, content, hash) {
    this.podPath = podPath
    this.frontMatter = autoDeepObject(frontMatter)
    this.rawFrontMatter = rawFrontMatter
    this._rawFrontMatter = rawFrontMatter
    this.servingPaths = servingPaths
    this.defaultLocale = defaultLocale || 'en'
    this.locale = this.defaultLocale
    this.locales = locales || [this.defaultLocale]
    this._content = content
    this.content = content
    this.hash = hash
  }

  get data() {
    // Format the data for selective editor.
    const data = {}

    for (const key of Object.keys(this.frontMatter.obj)) {
      data[key] = this.frontMatter.obj[key]
    }

    data['__content__'] = this.content

    return data
  }

  get isClean() {
    // If the raw front matter changes it is not clean.
    return (this.rawFrontMatter == this._rawFrontMatter
      && this.content == this._content)
  }

  get servingPath() {
    return this.servingPaths[this.defaultLocale]
  }

  update(podPath, frontMatter, rawFrontMatter, servingPaths, defaultLocale, locales, content, hash) {
    this.podPath = podPath
    this.frontMatter = autoDeepObject(frontMatter)
    this._rawFrontMatter = rawFrontMatter
    this.rawFrontMatter = rawFrontMatter
    this.servingPaths = servingPaths
    this.defaultLocale = defaultLocale || 'en'
    this.locale = this.defaultLocale
    this.locales = locales || [this.defaultLocale]
    this._content = content
    this.content = content
    this.hash = hash
  }
}
