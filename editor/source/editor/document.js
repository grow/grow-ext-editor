/**
 * Document for the editor.
 */

import { autoDeepObject } from '../utility/deepObject'

export default class Document {
  constructor(podPath, frontMatter, rawFrontMatter, servingPaths, defaultLocale, content) {
    this.podPath = podPath
    this.frontMatter = autoDeepObject(frontMatter)
    this.rawFrontMatter = rawFrontMatter
    this.servingPaths = servingPaths
    this.defaultLocale = defaultLocale
    this.locale = defaultLocale
    this.content = content
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

  get servingPath() {
    return this.servingPaths[this.defaultLocale]
  }

  update(podPath, frontMatter, rawFrontMatter, servingPaths, defaultLocale, content) {
    this.podPath = podPath
    this.frontMatter = autoDeepObject(frontMatter)
    this.rawFrontMatter = rawFrontMatter
    this.servingPaths = servingPaths
    this.defaultLocale = defaultLocale
    this.locale = defaultLocale
    this.content = content
  }
}
