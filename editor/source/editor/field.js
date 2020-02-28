/**
 * Field types for the editor extension.
 */

import * as extend from 'deep-extend'
import {
  autoDeepObject,
  html,
  repeat,
  Field,
  ListField,
  Fields,
} from 'selective-edit'

export class PartialsField extends ListField {
  constructor(config) {
    super(config)
    this.fieldType = 'partials'
    this.partialTypes = {}
    this._api = null

    // Set the api if it was provided
    if (this.getConfig().get('api')) {
      this.api = this.getConfig().get('api')
    }
  }

  _createItems(editor) {
    // No value yet.
    if (!this.value) {
      return []
    }

    let index = 0
    const items = []
    for (const itemData of this.value) {
      const partialKey = partialData['partial']
      const partialConfig = this.partialTypes[partialKey]

      // Skip missing partials.
      // TODO: Make this work with placeholders.
      if (!partialConfig) {
        // Add as a hidden partial.
        items.push({
          'id': `${this.getUid()}-${partialKey}-${index}`,
          'partialConfig': {},
          'index': index,
          'partialKey': partialKey,
          'itemFields': [],
          'isExpanded': false,
          'isHidden': true,
        })

        index += 1
        continue
      }

      const itemFields = new PartialFields(editor.fieldTypes, {
        'partial': partialConfig,
      })
      itemFields.valueFromData(itemData)

      for (const fieldConfig of fieldConfigs || []) {
        itemFields.addField(fieldConfig)
      }

      // When a partial is not expanded and not hidden it does not get the value
      // updated correctly so we need to manually call the data update.
      // for (const itemField of itemFields.fields) {
      //   itemField.updateFromData(itemData)
      // }

      items.push({
        'id': `${this.getUid()}-${partialKey}-${index}`,
        'index': index,
        'partialConfig': partialConfig,
        'partialKey': partialKey,
        'itemFields': itemFields,
        'isExpanded': false,
        'isHidden': false,
      })

      index += 1
    }
    return items
  }

  get api() {
    return this._api
  }

  get isExpanded() {
    // Count all partials that are not hidden.
    if (this._listItems) {
      let nonHiddenItemCount = 0
      for (const item of this._listItems) {
        if (!item['isHidden']) {
          nonHiddenItemCount += 1
        }
      }

      // Handle when all partials are expanded manually.
      if (nonHiddenItemCount > 0 && this._expandedIndexes.length == nonHiddenItemCount) {
        return true
      }
    }

    return this._isExpanded
  }

  // TODO: Retrieve the value from item fields.
  // get value() {
  //   if (!this.partialItems) {
  //     return this._value
  //   }
  //
  //   // Loop through each nested partial fields and get their values.
  //   const partials = []
  //   for (const partialItem of this.partialItems) {
  //     if (partialItem['isHidden']) {
  //       partials.push(this._value[partialItem['partialIndex']])
  //     } else {
  //       for (const partialFields of partialItem['partialsFields']) {
  //         partials.push(partialFields.value)
  //       }
  //     }
  //   }
  //   return partials
  // }

  set api(api) {
    this._api = api
    this.updatePartials()
  }

  handleAddItem(evt, editor) {
    // TODO: Fix for partial adding.
    console.log('Add partial!', evt.target.value);
    return

    const index = this.value.length
    const itemFields = new Fields(editor.fieldTypes)

    // Use the field config for the list items to create the correct field types.
    const fieldConfigs = this.getConfig().get('fields', [])

    for (const fieldConfig of fieldConfigs || []) {
      itemFields.addField(fieldConfig)
    }

    this._listItems.push({
      'id': `${this.getUid()}-${index}`,
      'index': index,
      'itemFields': itemFields,
      'isExpanded': false,
    })

    if (fieldConfigs.length > 1) {
      this.value.push({})
    } else {
      this.value.push('')
    }

    // Expanded by default.
    this._expandedIndexes.push(index)

    document.dispatchEvent(new CustomEvent('selective.render'))
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

  renderActionsFooter(editor, field, data) {
    return html`<div class="selective__actions">
      <select @change=${field.handleAddItem}>
        <option value="">${field.options['addLabel'] || 'Add section'}</option>
        ${repeat(Object.entries(field.partialTypes), (item) => item[0], (item, index) => html`
          <option value="${item[1]['key']}">${item[1]['label']}</option>
        `)}
      </select>
    </div>`
  }

  renderCollapsedPartial(editor, partialItem) {
    return html`
    <div class="partials__list__item"
        draggable="true"
        data-index=${partialItem['partialIndex']}
        @dragenter=${this.handleDragEnter.bind(this)}
        @dragleave=${this.handleDragLeave.bind(this)}
        @dragstart=${this.handleDragStart.bind(this)}
        @dragover=${this.handleDragOver.bind(this)}
        @drop=${this.handleDrop.bind(this)}>
      <div class="partials__list__item__drag"><i class="material-icons">drag_indicator</i></div>
      <div class="partials__list__item__label" data-index=${partialItem['partialIndex']} @click=${this.handlePartialExpand.bind(this)}>${partialItem['partialConfig']['label']}</div>
      <div class="partials__list__item__preview" data-index=${partialItem['partialIndex']} @click=${this.handlePartialExpand.bind(this)}>
        ${partialItem['partialConfig']['preview_field']
          ? autoDeepObject(this._value[partialItem['partialIndex']]).get(partialItem['partialConfig']['preview_field'])
          : ''}
      </div>
    </div>`
  }

  renderExpandedPartial(editor, partialItem) {
    return html`${repeat(partialItem['partialsFields'], (partialFields) => partialFields.getUid(), (partialFields, index) => html`
      <div class="selective__fields selective__fields__partials"
          draggable="true"
          data-fields-type="partials"
          data-index=${partialItem['partialIndex']}
          @dragenter=${this.handleDragEnter.bind(this)}
          @dragleave=${this.handleDragLeave.bind(this)}
          @dragstart=${this.handleDragStart.bind(this)}
          @dragover=${this.handleDragOver.bind(this)}
          @drop=${this.handleDrop.bind(this)}>
        <div class="partial__fields__label" data-index=${partialItem['partialIndex']} @click=${this.handlePartialCollapse.bind(this)}>${partialFields.label}</div>
        ${partialFields.template(editor, partialFields, this._value[partialItem['partialIndex']])}
      </div>`)}`
  }

  renderHiddenPartial(editor, partialItem) {
    return html`
    <div class="partials__list__item partials__list__item--hidden"
        draggable="true"
        data-index=${partialItem['partialIndex']}
        @dragenter=${this.handleDragEnter.bind(this)}
        @dragleave=${this.handleDragLeave.bind(this)}
        @dragstart=${this.handleDragStart.bind(this)}
        @dragover=${this.handleDragOver.bind(this)}
        @drop=${this.handleDrop.bind(this)}>
      <div class="partials__list__item__drag"><i class="material-icons">drag_indicator</i></div>
      <div class="partials__list__item__label" data-index=${partialItem['partialIndex']}>${partialItem['partialConfig']['label'] || partialItem['partialKey']}</div>
    </div>`
  }

  renderPartials(editor, data) {
    if (Object.entries(this.partialTypes).length === 0) {
      // Partial types have not loaded. Skip for now.
      return
    }

    if (!this.partialItems) {
      this.partialItems = this.createPartialItems(editor, data)
    }

    // Update the expanded state each render.
    for (const partialItem of this.partialItems) {
      partialItem['isExpanded'] = this.isExpanded || (this._expandedIndexes.indexOf(partialItem['partialIndex']) > -1)
    }

    return html`${repeat(this.partialItems, (partialItem) => partialItem['key'], (partialItem, index) => html`
      ${partialItem['isExpanded']
        ? this.renderExpandedPartial(editor, partialItem)
        : partialItem['isHidden']
          ? this.renderHiddenPartial(editor, partialItem)
          : this.renderCollapsedPartial(editor, partialItem)}
    `)}`
  }

  updatePartials() {
    this.api.getPartials().then(this.handleLoadPartialsResponse.bind(this))
  }
}

export class TextField extends Field {
  constructor(config) {
    super(config)
    this.fieldType = 'text'

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <input type="text" id="${field.getUid()}" value="${field.valueFromData(data)}" @input=${field.handleInput.bind(field)}>
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

    this.template = (editor, fields, data) => html`
      ${fields.valueFromData(data)}
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
