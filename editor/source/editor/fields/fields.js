/**
 * Partials fields.
 */

import {
 Fields,
} from 'selective-edit'


export default class PartialsFields extends Fields {
  constructor(fieldTypes, ruleTypes, config, partialKey) {
    super(fieldTypes, ruleTypes, config)

    this._partialKey = partialKey
  }

  get defaultValue() {
    return {
      'partial': this._partialKey,
    }
  }
}
