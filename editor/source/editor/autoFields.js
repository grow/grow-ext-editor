/**
 * Automatically guess the field configuration from data.
 */

import { AutoFields } from 'selective-edit'
import DataType from '../utility/dataType'


const MEDIA_REGEX = /\.(jp[e]?g|png|svg|webp|gif|avif)$/i
const GOOGLE_MEDIA_REGEX = /(\.googleusercontent.com|storage.googleapis.com)\//i


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
    if (DataType.isArray(value)) {
      if (key == 'partials') {
        return 'partials'
      }
    }

    if (DataType.isObject(value)) {
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
      if(value.match(GOOGLE_MEDIA_REGEX)) {
        return 'google_media'
      }

      if (value.startsWith('/') && value.match(MEDIA_REGEX)) {
        return 'media'
      }
    }

    return super.typeFromValue(value, key)
  }
}
