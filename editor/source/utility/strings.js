import DataType from './dataType'
import DeepObject from './deepObject'


const STRINGS_POD_PATH = '/content/strings/'
const STRINGS_EXTENSION = '.yaml'


export default class Strings {
  constructor(strings) {
    this.strings = strings
    this._deep = {}
  }

  string(key) {
    const parts = key.split('.')
    if (parts.length < 2) {
      return key
    }
    const filename = parts.shift()
    const podPath = `${STRINGS_POD_PATH}${filename}${STRINGS_EXTENSION}`
    if (!this._deep[podPath]) {
      this._deep[podPath] = new DeepObject(this.strings[podPath] || {})
    }
    return this._deep[podPath].get(parts.join('.'))
  }
}

export function textOrString(value, strings, loadStrings) {
  if (DataType.isObject(value) && value.tag == '!g.string') {
    if (!strings) {
      loadStrings()
      return value
    }
    return strings.string(value.value)
  }

  return value
}
