/**
 * Field types for the editor extension.
 */

import * as extend from 'deep-extend'
import {
  autoDeepObject,
  html,
  repeat,
  Field,
  Fields,
} from 'selective-edit'

export class PartialsField extends Field {
  constructor(config) {
    super(config)
    this.fieldType = 'textarea'
    this.partialTypes = {}
    this.partialsFields = []
    this._api = null
    this._dataValue = []
    this._value = []

    // Set the api if it was provided
    if (this.getConfig().get('api')) {
      this.api = this.getConfig().get('api')
    }

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__partials">
      <div class="partials__menu">
        <div class="partials__label">${field.label}</div>
        <div class="editor__actions">
          <button class="partials__action--expand">Expand All</button>
          <button class="partials__action--collapse">Collapse All</button>
        </div>
      </div>
      <div class="partials__items">
        <div class="partials__list" id="${field.getUid()}">
          ${field.valueFromData(data)}
          ${field.renderPartials(editor, data)}
        </div>

        <div class="partials__add">
          <select name="pets" id="pet-select">
            <option value="">${field.options['defaultLabel'] || ''}</option>
            ${repeat(Object.entries(field.partialTypes), (item) => item[0], (item, index) => html`
              <option value="${item[1]['key']}">${item[1]['label']}</option>
            `)}
          </select>
          <button>${field.options['addLabel'] || 'Add section'}</button>
        </div>
      </div>
    </div>`
  }

  get api() {
    return this._api
  }

  get value() {
    // Loop through each nested partial fields and get their values.
    const partials = []
    for (const partialFields of this.partialsFields) {
      partials.push(partialFields.value)
    }
    return partials
  }

  set api(api) {
    this._api = api
    this.updatePartials()
  }

  set value(value) {
    this._value = value || []
  }

  handleLoadPartialsResponse(response) {
    const partialTypes = []

    // Sorted objects for the partials.
    const partialKeys = Object.keys(response['partials']).sort()
    for (const key of partialKeys) {
      const newPartial = response['partials'][key]
      newPartial['key'] = key
      partialTypes[key] = newPartial
    }

    this.partialTypes = partialTypes

    // Trigger a re-render after the partials load.
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  get isClean() {
    // TODO: Better array comparisons?
    return JSON.stringify(this._dataValue) == JSON.stringify(this.value)
  }

  renderPartials(editor) {
    if (Object.entries(this.partialTypes).length === 0) {
      // Partial types have not loaded. Skip for now.
      return
    }

    this.partialsFields = []
    for (const partialData of this._value) {
      const partialKey = partialData['partial']
      const partialConfig = this.partialTypes[partialKey]

      // Skip missing partials.
      if (!partialConfig) {
        continue
      }

      const partialFields = new PartialFields(editor.fieldTypes, {
        'partial': partialConfig,
      })

      for (const fieldConfig of partialConfig['fields'] || []) {
        partialFields.addField(fieldConfig)
      }

      this.partialsFields.push(partialFields)
    }

    return html`${repeat(this.partialsFields, (partialFields) => partialFields.getUid(), (partialFields, index) => html`
      ${partialFields.template(editor, partialFields, this._value[index])}
    `)}`
  }

  updatePartials() {
    this.api.getPartials().then(this.handleLoadPartialsResponse.bind(this))
  }

  valueFromData(data) {
    super.valueFromData(data)

    // Do not return anything for partials.
    // The template is rendered from the nested partial fields.
  }
}

export class TextField extends Field {
  constructor(config) {
    super(config)
    this.fieldType = 'text'

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <input type="text" id="${field.getUid()}" class="mdc-text-field__input" value="${field.valueFromData(data)}" @input=${field.handleInput.bind(field)}>
    </div>`
  }
}

export class TextareaField extends Field {
  constructor(config) {
    super(config)
    this.fieldType = 'textarea'

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <textarea id="${field.getUid()}" rows="${field.options.rows || 6}" @input=${field.handleInput.bind(field)}>${field.valueFromData(data) || ' '}</textarea>
    </div>`
  }
}

class PartialFields extends Fields {
  constructor(fieldTypes, config, partialKey) {
    super(fieldTypes, config)

    this.label = this.getConfig().get('partial', {})['label'] || 'Partial'
    this.partialKey = partialKey

    this.template = (editor, fields, data) => html`<div class="selective__fields selective__fields__partials" data-fields-type="partials">
      <div class="partial__fields__label">${fields.label}</div>
      ${fields.valueFromData(data)}
      ${repeat(fields.fields, (field) => field.getUid(), (field, index) => html`
        ${field.template(editor, field, data)}
      `)}
    </div>`
  }
}


export const defaultFields = {
  'partials': PartialsField,
  'text': TextField,
  'textarea': TextareaField,
}
