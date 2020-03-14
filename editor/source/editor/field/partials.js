/**
 * Partials field types for the editor extension.
 */

import {
  autoConfig,
  html,
  repeat,
  Field,
  ListField,
  Fields,
} from 'selective-edit'
import EditorAutoFields from '../autoFields'


class PartialFields extends Fields {
  constructor(fieldTypes, config, partialKey) {
    super(fieldTypes, config)

    this.label = this.getConfig().get('partial', {})['label'] || 'Partial'
    this.partialKey = partialKey

    this.template = (selective, fields, data) => html`
      ${fields.valueFromData(data)}
      ${repeat(fields.fields, (field) => field.getUid(), (field, index) => html`
        ${field.template(selective, field, data)}
      `)}`
  }
}

export class PartialsField extends ListField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'partials'
    this.partialTypes = {}
    this._api = null

    // Set the api if it was provided
    if (this.getConfig().get('api')) {
      this.api = this.getConfig().get('api')
    }
  }

  _createItems(selective, data) {
    // No value yet.
    if (!this.value) {
      return []
    }

    // No partials loaded yet.
    if (!Object.keys(this.partialTypes).length) {
      return []
    }

    const autoGuessMissing = this.getConfig().get('autoGuess', true)

    let index = 0
    const items = []
    for (const itemData of this.value) {
      const partialKey = itemData['partial']
      let partialConfig = this.partialTypes[partialKey]

      // If allowed to guess use a stub of the partial config.
      if (!partialConfig && autoGuessMissing) {
        partialConfig = {
          label: partialKey,
          fields: [],
        }
      }

      if (!partialConfig['label'] && itemData['tag'].startsWith('!g.') && itemData['value']) {
        partialConfig['label'] = `${itemData['tag']} ${itemData['value']}`
      }

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
          'useAutoFields': false,
        })

        index += 1
        continue
      }

      const itemFields = new PartialFields(selective.fieldTypes, {
        'partial': partialConfig,
      })
      itemFields.valueFromData(itemData)

      let fieldConfigs = partialConfig.fields
      const useAutoFields = fieldConfigs.length == 0

      if (useAutoFields) {
        // Auto guess the fields if they are not defined.
        fieldConfigs = new EditorAutoFields(itemData, {
          ignoredKeys: ['partial'],
        }).config['fields']
      }

      for (let fieldConfig of fieldConfigs || []) {
        fieldConfig = autoConfig(fieldConfig, this.extendedConfig)
        itemFields.addField(fieldConfig, this.extendedConfig)
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
        'useAutoFields': useAutoFields,
      })

      index += 1
    }
    return items
  }

  get api() {
    return this._api
  }

  get isExpanded() {
    if (this._listItems) {
      // If there is only one partial, expand it.
      if (this._listItems.length == 1) {
        return true
      }

      // Count all partials that are not hidden.
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

  handleAddItem(evt, selective) {
    const partialKey = evt.target.value
    const partialConfig = this.partialTypes[partialKey]
    const index = (this.value || []).length
    const itemFields = new PartialFields(selective.fieldTypes, {
      'partial': partialConfig,
    })
    itemFields.valueFromData({
      'partial': partialKey,
    })

    const fieldConfigs = partialConfig.fields
    for (let fieldConfig of fieldConfigs || []) {
      fieldConfig = autoConfig(fieldConfig, this.extendedConfig)
      itemFields.addField(fieldConfig, this.extendedConfig)
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

  renderActionsFooter(selective, field, data) {
    return html`<div class="selective__actions">
      <select class="selective__actions__add" @change=${(evt) => {field.handleAddItem(evt, selective)}}>
        <option value="">${field.options['addLabel'] || 'Add section'}</option>
        ${repeat(Object.entries(field.partialTypes), (item) => item[0], (item, index) => html`
          <option value="${item[1]['key']}">${item[1]['label']}</option>
        `)}
      </select>
    </div>`
  }

  renderActionsHeader(selective, field, data) {
    // Hide when there are no values to expand/collapse.
    if ((this.value || []).length <= 1) {
      return ''
    }

    // Allow collapsing and expanding of sub fields.
    return html`<div class="selective__actions">
      <button class="selective__action__toggle" @click=${field.handleToggleExpand.bind(field)}>
        ${field.isExpanded ? 'Collapse' : 'Expand'}
      </button>
    </div>`
  }

  renderCollapsedPartial(selective, partialItem) {
    return html`
      <div class="selective__list__item__drag"><i class="material-icons">drag_indicator</i></div>
      <div class="selective__list__item__label" data-index=${partialItem['index']} @click=${this.handleItemExpand.bind(this)}>
        ${partialItem['partialConfig']['label']}
      </div>
      ${this.renderPreview(partialItem)}
      <div
          class="selective__list__item__delete"
          data-index=${partialItem['index']}
          @click=${this.handleItemDelete.bind(this)}
          title="Delete ${partialItem['partialConfig']['label']}">
        <i class="material-icons">delete</i>
      </div>`
  }

  renderExpandedPartial(selective, partialItem) {
    const fields = partialItem.itemFields
    return html`
      <div class="selective__list__item__label" data-index=${partialItem['index']} @click=${this.handleItemCollapse.bind(this)}>
        ${partialItem['partialConfig']['label']}
      </div>
      ${fields.template(selective, fields, this.value[partialItem['index']])}`
    return
  }

  renderHiddenPartial(selective, partialItem) {
    return html`
      <div class="selective__list__item__drag"><i class="material-icons">drag_indicator</i></div>
      <div class="selective__list__item__label" data-index=${partialItem['index']}>
        ${partialItem['partialConfig']['label'] || partialItem['partialKey']}
      </div>
      <div
          class="selective__list__item__delete"
          data-index=${partialItem['index']}
          @click=${this.handleItemDelete.bind(this)}
          title="Delete ${partialItem['partialConfig']['label'] || partialItem['partialKey']}">
        <i class="material-icons">delete</i>
      </div>`
  }

  renderItems(selective, data) {
    // No partials loaded yet.
    if (!Object.keys(this.partialTypes).length) {
      return html`<div class="editor__loading" title="Loading partial configurations"></div>`
    }

    this.ensureItems(selective, data)

    // Update the expanded state each render.
    for (const listItem of this._listItems) {
      const inIndex = this._expandedIndexes.indexOf(listItem['index']) > -1
      listItem['isExpanded'] = !listItem['isHidden'] && (this.isExpanded || inIndex)
    }

    return html`${repeat(this._listItems, (listItem) => listItem['id'], (listItem, index) => html`
      <div class="selective__list__item selective__list__item--${listItem['isExpanded'] ? 'expanded' : listItem['isHidden'] ? 'hidden' : 'collapsed'} ${listItem['useAutoFields'] ? 'selective__list__item--auto' : ''}"
          draggable="true"
          data-index=${listItem['index']}
          @dragenter=${this.handleDragEnter.bind(this)}
          @dragleave=${this.handleDragLeave.bind(this)}
          @dragover=${this.handleDragOver.bind(this)}
          @dragstart=${this.handleDragStart.bind(this)}
          @drop=${this.handleDrop.bind(this)}>
        ${listItem['isExpanded']
          ? this.renderExpandedPartial(selective, listItem)
          : listItem['isHidden']
            ? this.renderHiddenPartial(selective, listItem)
            : this.renderCollapsedPartial(selective, listItem)}
      </div>
    `)}`
  }

  renderPreview(partialItem) {
    const previewValue = this._determineItemPreview(partialItem)

    if (!previewValue) {
      return ''
    }

    return html`<div class="selective__list__item__preview" data-index=${partialItem['index']} @click=${this.handleItemExpand.bind(this)}>
      ${previewValue}
    </div>`
  }

  updatePartials() {
    this.api.getPartials().then(this.handleLoadPartialsResponse.bind(this))
  }
}