/**
 * Automatically guess the field configuration from data.
 */

import { AutoFields } from 'selective-edit'

export default class EditorAutoFields extends AutoFields {
  /**
   * From a value, guess the type of field.
   */
  typeFromValue(value) {
    console.log('Guessing', value);
    return super.typeFromValue(value)
  }
}
