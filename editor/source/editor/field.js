/**
 * Field types for the editor extension.
 */

import {
  autoDeepObject,
  html,
  repeat,
  Field,
  Fields,
} from 'selective-edit'
import {
  MDCSelect
} from '@material/select/index'

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
      <div class="partials">
        <div class="partials__label">${field.label}</div>
        <div class="partials__items">
          <div class="partials__list" id="${field.getUid()}">
            ${field.valueFromData(data)}
            ${field.renderPartials(editor, data)}
          </div>
          <div class="partials__add">
            <div class="mdc-select mdc-select--outlined">
              <div class="mdc-select__anchor">
                <div class="mdc-notched-outline">
                  <i class="mdc-select__dropdown-icon"></i>
                  <div class="mdc-notched-outline__leading"></div>
                  <div class="mdc-notched-outline__notch">
                    <label class="mdc-floating-label">${field.options['addLabel'] || field.label}</label>
                  </div>
                  <div class="mdc-notched-outline__trailing"></div>
                </div>
              </div>
              <div class="mdc-select__menu mdc-menu mdc-menu-surface">
                <ul class="mdc-list">
                  <li class="mdc-list-item mdc-list-item--selected" data-value="" aria-selected="true"></li>
                  <li class="mdc-list-item" data-value="test">Testing</li>
                  ${repeat(Object.keys(field.partialTypes), (key) => key, (key, index) => html`
                    <li class="mdc-list-item" data-value="${key}">${key}</li>
                  `)}
                </ul>
              </div>
            </div>
            <button class="mdc-button mdc-button--outlined">
              <div class="mdc-button__ripple"></div>
              <i class="material-icons mdc-button__icon" aria-hidden="true">add</i>
              <span class="mdc-button__label">Add</span>
            </button>
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

  static initialize(containerEl) {
    const fieldInstances = containerEl.querySelectorAll('.selective__field__partials')
    this.intializeMaterialComponents(
      fieldInstances, '.mdc-select', MDCSelect)
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

class PartialFields extends Fields {
  constructor(fieldTypes, config) {
    super(fieldTypes, config)

    this.label = this.getConfig().get('partial', {})['label'] || 'Partial'

    this.template = (editor, fields, data) => html`<div class="selective__fields selective__fields__partial">
      <div class="partial__label">${fields.label}</div>
      ${repeat(fields.fields, (field) => field.getUid(), (field, index) => html`
        ${field.template(editor, field, data)}
      `)}
    </div>`
  }
}


export const defaultFields = {
  'partials': PartialsField,
}
