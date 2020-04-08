/**
 * Automatically guess the field configuration from data.
 */

import { AutoFields } from 'selective-edit'

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
   * From a value, guess the type of field.
   */
  typeFromValue(value) {
    if (this.DataType.isObject(value) && this._isConstructor(value)) {
      switch (value['tag']) {
        case '!g.doc':
          return 'document'
          break
        case '!g.yaml':
          return 'yaml'
          break
        case '!g.string':
          return 'string'
          break
      }
    }

    if (typeof value == 'boolean') {
      return 'checkbox'
    }

    return super.typeFromValue(value)
  }
}
