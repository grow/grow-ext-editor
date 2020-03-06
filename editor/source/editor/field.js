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

export class ConstructorField extends Field {
  constructor(config) {
    super(config)
    this.fieldType = 'constructor'
    this.tag = '!g.*'

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <input type="text" id="${field.getUid()}" value="${field.valueFromData(data)}" @input=${field.handleInput.bind(field)}>
    </div>`
  }

  handleInput(evt) {
    // Update the value to what is being typed.
    // Helps mark the field as dirty.
    this.value = {
      'value': evt.target.value,
      'tag': this.tag,
    }
  }

  valueFromData(data) {
    const value = super.valueFromData(data)
    if (value) {
      return value['value']
    }
    return ''
  }
}

export class DocumentField extends ConstructorField {
  constructor(config) {
    super(config)
    this.fieldType = 'document'
    this.tag = '!g.doc'
  }
}

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

  _createItems(editor, data) {
    // No value yet.
    if (!this.value) {
      return []
    }

    // No partials loaded yet.
    if (!Object.keys(this.partialTypes).length) {
      return []
    }

    let index = 0
    const items = []
    for (const itemData of this.value) {
      const partialKey = itemData['partial']
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

      const fieldConfigs = partialConfig.fields
      for (const fieldConfig of fieldConfigs || []) {
        itemFields.addField(fieldConfig)
      }

      // When a partial is not expanded and not hidden it does not get the value
      // updated correctly so we need to manually call the data update.
      for (const itemField of itemFields.fields) {
        itemField.updateFromData(itemData)
      }

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

  get value() {
    if (!this._listItems || this._listItems.length < 1) {
      return this._dataValue
    }

    // Loop through each fields and get the values.
    const values = []
    for (const item of this._listItems) {
      if (item['isHidden']) {
        values.push(this._dataValue[item['index']])
      } else {
        values.push(item['itemFields'].value)
      }
    }

    return values
  }

  set api(api) {
    this._api = api
    this.updatePartials()
  }

  set isExpanded(value) {
    super.isExpanded = value
  }

  set value(value) {
    // no-op
  }

  handleAddItem(evt, editor) {
    const partialKey = evt.target.value
    const partialConfig = this.partialTypes[partialKey]
    const index = this.value.length
    const itemFields = new PartialFields(editor.fieldTypes, {
      'partial': partialConfig,
    })
    itemFields.valueFromData({
      'partial': partialKey,
    })

    const fieldConfigs = partialConfig.fields
    for (const fieldConfig of fieldConfigs || []) {
      itemFields.addField(fieldConfig)
    }

    this._listItems.push({
      'id': `${this.getUid()}-${partialKey}-${index}`,
      'index': index,
      'partialConfig': partialConfig,
      'partialKey': partialKey,
      'itemFields': itemFields,
      'isExpanded': false,
      'isHidden': false,
    })

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

  renderActionsFooter(editor, field, data) {
    return html`<div class="selective__actions">
      <select @change=${(evt) => {field.handleAddItem(evt, editor)}}>
        <option value="">${field.options['addLabel'] || 'Add section'}</option>
        ${repeat(Object.entries(field.partialTypes), (item) => item[0], (item, index) => html`
          <option value="${item[1]['key']}">${item[1]['label']}</option>
        `)}
      </select>
    </div>`
  }

  renderActionsHeader(editor, field, data) {
    // Allow collapsing and expanding of sub fields.
    return html`<div class="selective__actions">
      <button class="selective__action__toggle" @click=${field.handleToggleExpand.bind(field)}>
        ${field.isExpanded ? 'Collapse' : 'Expand'}
      </button>
    </div>`
  }

  renderListItemPreview(partialItem, deepObject) {
    return html`<div class="selective__list__item__preview" data-index=${partialItem['index']} @click=${this.handleItemExpand.bind(this)}>
      ${deepObject}
    </div>`
  }

  renderCollapsedPartial(editor, partialItem) {
    let previewField = partialItem['partialConfig']['preview_field'];
    let deepObject = previewField && autoDeepObject(this.value[partialItem['index']]).get(partialItem['partialConfig']['preview_field']);
    return html`
      <div class="selective__list__item__drag"><i class="material-icons">drag_indicator</i></div>
      <div class="selective__list__item__label" data-index=${partialItem['index']} @click=${this.handleItemExpand.bind(this)}>
        ${partialItem['partialConfig']['label']}
      </div>
      ${previewField && deepObject ? this.renderListItemPreview(partialItem, deepObject) : ''}
      `
  }

  renderExpandedPartial(editor, partialItem) {
    const fields = partialItem.itemFields
    return html`
      <div class="selective__list__item__label" data-index=${partialItem['index']} @click=${this.handleItemCollapse.bind(this)}>
        ${partialItem['partialConfig']['label']}
      </div>
      ${fields.template(editor, fields, this.value[partialItem['index']])}`
    return
  }

  renderHiddenPartial(editor, partialItem) {
    return html`
      <div class="selective__list__item__drag"><i class="material-icons">drag_indicator</i></div>
      <div class="selective__list__item__label" data-index=${partialItem['index']}>
        ${partialItem['partialConfig']['label'] || partialItem['partialKey']}
      </div>`
  }

  renderItems(editor, data) {
    // If the sub fields have not been created create them now.
    if (!this._listItems.length) {
      this._listItems = this._createItems(editor, data)
    }

    // Update the expanded state each render.
    for (const listItem of this._listItems) {
      const inIndex = this._expandedIndexes.indexOf(listItem['index']) > -1
      listItem['isExpanded'] = !listItem['isHidden'] && (this.isExpanded || inIndex)
    }

    return html`${repeat(this._listItems, (listItem) => listItem['id'], (listItem, index) => html`
      <div class="selective__list__item selective__list__item--${listItem['isExpanded'] ? 'expanded' : listItem['isHidden'] ? 'hidden' : 'collapsed'}"
          draggable="true"
          data-index=${listItem['index']}
          @dragenter=${this.handleDragEnter.bind(this)}
          @dragleave=${this.handleDragLeave.bind(this)}
          @dragover=${this.handleDragOver.bind(this)}
          @dragstart=${this.handleDragStart.bind(this)}
          @drop=${this.handleDrop.bind(this)}>
        ${listItem['isExpanded']
          ? this.renderExpandedPartial(editor, listItem)
          : listItem['isHidden']
            ? this.renderHiddenPartial(editor, listItem)
            : this.renderCollapsedPartial(editor, listItem)}
      </div>
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
      <input type="text" id="${field.getUid()}" value="${field.valueFromData(data) || ''}" @input=${field.handleInput.bind(field)}>
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

export class YamlField extends ConstructorField {
  constructor(config) {
    super(config)
    this.fieldType = 'yaml'
    this.tag = '!g.yaml'
  }
}


export const defaultFields = {
  'document': DocumentField,
  'partials': PartialsField,
  'list': ListField,
  'text': TextField,
  'textarea': TextareaField,
  'yaml': YamlField,
}
