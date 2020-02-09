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
    this._isExpanded = false
    this._expandedIndexes = []
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
          <button class="partials__action__toggle" @click=${field.handleToggleExpandPartials.bind(field)}>
            ${field.isExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>
      <div class="partials__items">
        <div class="partials__list" id="${field.getUid()}">
          ${field.valueFromData(data)}
          ${field.renderPartials(editor, data)}
        </div>

        <div class="partials__add">
          <select @change=${field.handleAddPartial}>
            <option value="">${field.options['addLabel'] || 'Add section'}</option>
            ${repeat(Object.entries(field.partialTypes), (item) => item[0], (item, index) => html`
              <option value="${item[1]['key']}">${item[1]['label']}</option>
            `)}
          </select>
        </div>
      </div>
    </div>`
  }

  get api() {
    return this._api
  }

  get isExpanded() {
    return this._isExpanded
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

  set isExpanded(value) {
    this._isExpanded = value

    // TODO: Save to local storage
  }

  set value(value) {
    this._value = value || []
  }

  handleAddPartial(evt) {
    console.log('Add partial!', evt.target.value);
  }

  handleExpandPartial(evt) {
    this._expandedIndexes.push(evt.dataset.index)
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

  handlePartialCollapse(evt) {
    const expandIndex = this._expandedIndexes.indexOf(parseInt(evt.target.dataset.index))
    if (expandIndex > -1) {
      this._expandedIndexes.splice(expandIndex, 1)
      document.dispatchEvent(new CustomEvent('selective.render'))
    }
  }

  handlePartialExpand(evt) {
    this._expandedIndexes.push(parseInt(evt.target.dataset.index))
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  handleToggleExpandPartials(evt) {
    this.isExpanded = !this.isExpanded
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  get isClean() {
    // TODO: Better array comparisons?
    return JSON.stringify(this._dataValue) == JSON.stringify(this.value)
  }

  renderCollapsedPartial(editor, partialItem) {
    return html`<div class="partials__list__item">
        <div class="partials__list__item__drag"><i class="material-icons">drag_indicator</i></div>
        <div class="partials__list__item__label" data-index=${partialItem['partialIndex']} @click=${this.handlePartialExpand.bind(this)}>${partialItem['partialConfig']['label']}</div>
        <div class="partials__list__item__preview">
          ${partialItem['partialConfig']['preview_field']
            ? autoDeepObject(this._value[partialItem['partialIndex']]).get(partialItem['partialConfig']['preview_field'])
            : ''}
        </div>
      </div>`
  }

  renderExpandedPartial(editor, partialItem) {
    return html`${repeat(partialItem['partialsFields'], (partialFields) => partialFields.getUid(), (partialFields, index) => html`
      <div class="selective__fields selective__fields__partials" data-fields-type="partials">
        <div class="partial__fields__label" data-index=${partialItem['partialIndex']} @click=${this.handlePartialCollapse.bind(this)}>${partialFields.label}</div>
          ${partialFields.template(editor, partialFields, this._value[partialItem['partialIndex']])}
      </div>`)}`
  }

  renderPartials(editor, data) {
    if (Object.entries(this.partialTypes).length === 0) {
      // Partial types have not loaded. Skip for now.
      return
    }

    // Track the index separately since we skip missing partials
    // and the data needs to match up with the partial display.
    let partialIndex = 0
    const partialItems = []
    for (const partialData of this._value) {
      const partialKey = partialData['partial']
      const partialConfig = this.partialTypes[partialKey]
      const isExpanded = this.isExpanded || (this._expandedIndexes.indexOf(partialIndex) > -1)

      // Skip missing partials.
      if (!partialConfig) {
        partialIndex += 1
        continue
      }

      const partialsFields = []
      if (isExpanded) {
        const partialFields = new PartialFields(editor.fieldTypes, {
          'partial': partialConfig,
        })

        for (const fieldConfig of partialConfig['fields'] || []) {
          partialFields.addField(fieldConfig)
        }

        partialsFields.push(partialFields)
      }


      partialItems.push({
        'id': partialKey + ':' + partialIndex,
        'partialConfig': partialConfig,
        'partialIndex': partialIndex,
        'partialsFields': partialsFields,
        'isExpanded': isExpanded,
      })

      partialIndex += 1
    }

    return html`${repeat(partialItems, (partialItem) => partialItem['key'], (partialItem, index) => html`
      ${partialItem['isExpanded']
        ? this.renderExpandedPartial(editor, partialItem)
        : this.renderCollapsedPartial(editor, partialItem)}
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

    this.template = (editor, fields, data) => html`${fields.valueFromData(data)}
      ${repeat(fields.fields, (field) => field.getUid(), (field, index) => html`
        ${field.template(editor, field, data)}
      `)}`
  }
}


export const defaultFields = {
  'partials': PartialsField,
  'text': TextField,
  'textarea': TextareaField,
}
