/**
 * Partials fields.
 */

import {
 Fields,
} from 'selective-edit'


export default class PartialsFields extends Fields {
  constructor(fieldTypes, config, partialKey) {
    super(fieldTypes, config)

    this._partialKey = partialKey
  }

  get defaultValue() {
    return {
      'partial': this._partialKey,
    }
  }
}
