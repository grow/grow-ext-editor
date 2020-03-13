/**
 * Structure field types for the editor extension.
 */

import {
  autoConfig,
  autoDeepObject,
  html,
  repeat,
  Field,
  Fields,
} from 'selective-edit'
import EditorAutoFields from '../autoFields'

export class GroupField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'group'
    this.fields = null
    this.isExpanded = false
    this.template = (selective, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      ${field.ensureFields(selective, data)}
      ${field.updateFromData(data)}
      <div class="selective__field__${field.fieldType}__handle" @click=${field.handleToggleExpand.bind(field)}>
        <i class="material-icons">${field.isExpanded ? 'expand_less' : 'expand_more'}</i>
        <div class="selective__field__${field.fieldType}__label">${field.label}</div>
      </div>
      ${field.renderFields(selective, data)}
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  get isClean() {
    // If there are no fields, nothing has changed.
    if (!this.fields) {
      return true
    }

    for (const field of this.fields.fields) {
      if (!field.isClean) {
        return false
      }
    }
  }

  get value() {
    if (!this.fields) {
      return this._dataValue
    }

    const value = autoDeepObject({})

    for (const field of this.fields.fields) {
      value.set(field.key, field.value)
    }

    return value.obj
  }

  set value(value) {
    // no-op
  }

  _createFields(selective, data) {
    const fields = new Fields(selective.fieldTypes)
    fields.valueFromData(this.value)

    let fieldConfigs = this.getConfig().get('fields', [])
    const useAutoFields = fieldConfigs.length == 0

    if (useAutoFields) {
      // Auto guess the fields if they are not defined.
      fieldConfigs = new EditorAutoFields(this.value).config['fields']
    }

    for (let fieldConfig of fieldConfigs || []) {
      fieldConfig = autoConfig(fieldConfig, this.extendedConfig)
      fields.addField(fieldConfig, this.extendedConfig)
    }

    // When a not expanded it does not get the value updated correctly
    // so we need to manually call the data update.
    for (const field of fields.fields) {
      field.updateFromData(this.value || {})
    }

    return fields
  }

  // Ensure that fields are created so they can be populated and the keyless
  // groups can correctly return the partial value.
  ensureFields(selective, data) {
    // If the sub fields have not been created create them now.
    if (!this.fields) {
      this.fields = this._createFields(selective, data)
    }
  }

  handleToggleExpand(evt) {
    this.isExpanded = !this.isExpanded
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  renderFields(selective, data) {
    this.ensureFields()

    if (!this.isExpanded) {
      return ''
    }

    return html`<div class="selective__group">
      ${this.fields.template(selective, this.fields, this.value)}
    </div>`
  }

  valueFromData(data) {
    if (this.key) {
      return super.valueFromData(data)
    }

    // Nothing to do without fields.
    if (!this.fields) {
      this._dataValue = data
      return this.value
    }

    const newDataValue = autoDeepObject({})

    for (const field of this.fields.fields) {
      newDataValue.set(field.key, field.value)
    }

    this._dataValue = newDataValue.obj

    return this.value
  }
}
