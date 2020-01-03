/**
 * Document for the editor.
 */

import DeepObject from '../utility/deepObject'

export default class Document {
  constructor(podPath, frontMatter, rawFrontMatter, servingPaths, defaultLocale) {
    this.podPath = podPath
    this.frontMatter = new DeepObject(frontMatter)
    this.rawFrontMatter = rawFrontMatter
    this.servingPaths = servingPaths
    this.defaultLocale = defaultLocale
    this.locale = defaultLocale
  }

  get servingPath() {
    return this.servingPaths[this.defaultLocale]
  }

  update(podPath, frontMatter, rawFrontMatter, servingPaths, defaultLocale) {
    this.podPath = podPath
    this.frontMatter = new DeepObject(frontMatter)
    this.rawFrontMatter = rawFrontMatter
    this.servingPaths = servingPaths
    this.defaultLocale = defaultLocale
    this.locale = defaultLocale
  }
}
