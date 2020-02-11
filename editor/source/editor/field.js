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
    this._dragOriginElement = null
    this._dragHoverElement = null
    this._partialCount = 0
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
            ${field.isExpanded ? 'Collapse' : 'Expand'}
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
    // Handle when all partials are expanded manually.
    if (this._partialCount > 0 && this._expandedIndexes.length == this._partialCount) {
      return true
    }
    return this._isExpanded
  }

  get value() {

    // TODO: Make the values work correctly with hidden values...

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

  _findDraggable(target) {
    // Use the event target to traverse until the draggable element is found.
    let isDraggable = false
    while (target && !isDraggable) {
      isDraggable = target.getAttribute('draggable') == 'true'
      if (!isDraggable) {
        target = target.parentElement
      }
    }
    return target
  }

  handleAddPartial(evt) {
    console.log('Add partial!', evt.target.value);
  }

  handleDragStart(evt) {
    this._dragOriginElement = evt.target

    evt.dataTransfer.setData('text/plain', evt.target.dataset.index)
    evt.dataTransfer.setData('selective/index', evt.target.dataset.index)
    // TODO: Add data about the list that it is allowed to drop in.
    // evt.dataTransfer.setData('selective/list', evt.target.dataset.id)
    evt.dataTransfer.effectAllowed = 'move'
  }

  handleDragEnter(evt) {
    // Only allow dropping when the 'selective/index' custom data is set.
    if (this._dragOriginElement && evt.dataTransfer.types.includes('selective/index')) {
      const target = this._findDraggable(evt.target)

      if (!target) {
        return
      }

      const currentIndex = parseInt(evt.target.dataset.index)
      const startIndex = parseInt(this._dragOriginElement.dataset.index)

      // Show that the element is hovering.
      // Also prevent sub elements from triggering more drag events.
      target.classList.add('draggable--hover')

      if (currentIndex == startIndex) {
        // Hovering over self, ignore.
        return
      }

      if (currentIndex < startIndex) {
        target.classList.add('draggable--above')
      } else {
        target.classList.add('draggable--below')
      }
    }
  }

  handleDragLeave(evt) {
    // Only allow dropping when the 'selective/index' custom data is set.
    if (this._dragOriginElement && evt.dataTransfer.types.includes('selective/index')) {
      const target = this._findDraggable(evt.target)

      if (!target) {
        return
      }

      // No longer hovering.
      target.classList.remove('draggable--hover')
      target.classList.remove('draggable--above')
      target.classList.remove('draggable--below')
    }
  }

  handleDragOver(evt) {
    // Only allow dropping when the 'selective/index' custom data is set.
    if (this._dragOriginElement && evt.dataTransfer.types.includes('selective/index')) {
      evt.preventDefault()
    }
  }

  handleDrop(evt) {
    // Trying to drag from outside the list.
    if (!this._dragOriginElement) {
      return
    }

    const target = this._findDraggable(evt.target)
    const currentIndex = parseInt(evt.target.dataset.index)
    const startIndex = parseInt(evt.dataTransfer.getData("text/plain"))

    // No longer hovering.
    target.classList.remove('draggable--hover')
    target.classList.remove('draggable--above')
    target.classList.remove('draggable--below')

    if (currentIndex == startIndex) {
      // Dropped on self, ignore.
      return
    }

    // Rework the array to have the items in the correct position.
    const newValue = []
    const newExpanded = []
    const oldValue = this._value
    const maxIndex = Math.max(currentIndex, startIndex)
    const minIndex = Math.min(currentIndex, startIndex)
    let modifier = 1
    if (startIndex > currentIndex) {
      modifier = -1
    }

    for (let i = 0; i < oldValue.length; i++) {
      if (i < minIndex || i > maxIndex) {
        // Leave in the same order.
        newValue[i] = oldValue[i]

        if (this._expandedIndexes.includes(i)) {
          newExpanded.push(i)
        }
      } else if (i == currentIndex) {
        newValue[i] = oldValue[startIndex]

        if (this._expandedIndexes.includes(startIndex)) {
          newExpanded.push(i)
        }
      } else {
        // Shift the old index by one.
        newValue[i] = oldValue[i+modifier]

        if (this._expandedIndexes.includes(i+modifier)) {
          newExpanded.push(i)
        }
      }
    }

    this._value = newValue
    this._expandedIndexes = newExpanded
    this._dragOriginElement = null

    // Trigger a re-render after moving.
    document.dispatchEvent(new CustomEvent('selective.render'))
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
    this.isExpanded = false
    const partialIndex = parseInt(evt.target.dataset.index)
    const expandIndex = this._expandedIndexes.indexOf(partialIndex)
    if (expandIndex > -1) {
      this._expandedIndexes.splice(expandIndex, 1)
      document.dispatchEvent(new CustomEvent('selective.render'))
    }
  }

  handlePartialExpand(evt) {
    const partialIndex = parseInt(evt.target.dataset.index)
    this._expandedIndexes.push(partialIndex)
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  handleToggleExpandPartials(evt) {
    if (this.isExpanded) {
      // Clear out all expanded indexes when collapsing.
      this._expandedIndexes = []
      this.isExpanded = false
    } else {
      this.isExpanded = true
    }

    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  get isClean() {
    // TODO: Better array comparisons?
    return JSON.stringify(this._dataValue) == JSON.stringify(this.value)
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
        // Add as a hidden partial.
        partialItems.push({
          'id': partialKey + ':' + partialIndex,
          'partialConfig': {},
          'partialIndex': partialIndex,
          'partialKey': partialKey,
          'partialsFields': [],
          'isExpanded': false,
          'isHidden': true,
        })

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
        'partialKey': partialKey,
        'isExpanded': isExpanded,
        'isHidden': false,
      })

      partialIndex += 1
    }

    // Store how many partials are there in total.
    this._partialCount = partialItems.length

    return html`${repeat(partialItems, (partialItem) => partialItem['key'], (partialItem, index) => html`
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
