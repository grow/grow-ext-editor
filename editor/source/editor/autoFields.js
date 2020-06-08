/**
 * Automatically guess the field configuration from data.
 */

import { AutoFields } from 'selective-edit'


const IMAGE_REGEX = /\.(jp[e]?g|png|svg|webp|gif)$/i
const GOOGLE_IMAGE_REGEX = /\.googleusercontent.com\//i


export default class EditorAutoFields extends AutoFields {
  _deepGuessObject(data, keyBase) {
    // Handle the `!g.*` constructors.
    if (this._isConstructor(data)) {
      const fullKey = keyBase.join('.')
      return [this._fieldConfig(fullKey, data)]
    }

    return super._deepGuessObject(data, keyBase)
  }

  _isConstructor(data) {
    return data['tag'] && data['value'] && data['tag'].startsWith('!g.')
  }

  /**
   * From a key guess the label of the field.
   */
  labelFromKey(key) {
    let label = super.labelFromKey(key)
    // Strip off translation @.
    label = label.replace(/@$/, '')
    return label
  }

  /**
   * From a value, guess the type of field.
   */
  typeFromValue(value, key) {
    if (this.DataType.isArray(value)) {
      if (key == 'partials') {
        return 'partials'
      }
    }

    if (this.DataType.isObject(value)) {
      if (this._isConstructor(value)) {
        switch (value['tag']) {
          case '!g.doc':
            return 'document'
            break
          case '!g.static':
            return 'static'
            break
          case '!g.string':
            return 'string'
            break
          case '!g.yaml':
            return 'yaml'
            break
        }
      }
    }

    if (typeof value == 'boolean') {
      return 'checkbox'
    }

    if (value && typeof value == 'string') {
      if(value.match(GOOGLE_IMAGE_REGEX)) {
        return 'google_image'
      }

      if (value.startsWith('/') && value.match(IMAGE_REGEX)) {
        return 'image'
      }
    }

    return super.typeFromValue(value, key)
  }
}
