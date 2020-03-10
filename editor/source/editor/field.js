/**
 * Field types for the editor extension.
 */

import * as extend from 'deep-extend'
import {
  autoConfig,
  autoDeepObject,
  directive,
  html,
  repeat,
  Field,
  ListField,
  Fields,
  AutoFields,
} from 'selective-edit'

export class ConstructorField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
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
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'document'
    this.tag = '!g.doc'
  }
}

export class ImageField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'image'
    this.previewUrl = ''

    // Set the api if it was provided
    this.api = this.getConfig().get('api')

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <input type="text" id="${field.getUid()}" value="${field.valueFromData(data) || ''}" @input=${field.handleInput.bind(field)}>
      <input type="file" id="${field.getUid()}_file" placeholder="Upload new image" @change=${field.handleFileInput.bind(field)}>
      ${this.renderImagePreview(editor, field, data)}
    </div>`
  }

  renderImagePreview(editor, field, data) {
    if (field.previewUrl == '') {
      return ''
    }

    // Depends on image element, so needs to run after image has loaded.
    const imageSizeDirective = directive((field) => (part) => {
      setTimeout(() => {
        let el = document.getElementById(`${field.getUid()}_preview`);
        let imageEl = el.querySelector('img');
        imageEl.addEventListener('load', () => {
          part.setValue(`Aspect ratio: ${imageEl.naturalWidth}x${imageEl.naturalHeight}`);
          part.commit();
        })
      });
    })

    return html`
      <div class="selective__field__${field.fieldType}__preview" id="${field.getUid()}_preview">
        <div class="selective__field__${field.fieldType}__preview__image"><a href="${field.previewUrl}"><img src="${field.previewUrl}"></a></div>
        <div class="selective__field__${field.fieldType}__preview__meta">${imageSizeDirective(field)}</div>
      </div>`
  }

  handleFileInput(evt) {
    if (!this.api) {
      console.error('Missing api for image field.')
      return
    }

    const destination = this.getConfig().get('destination', '/static/img/upload')
    this.api.saveImage(evt.target.files[0], destination).then((result) => {
      this.value = result
      this.previewUrl = result
      document.dispatchEvent(new CustomEvent('selective.render'))
    })
  }
}

// TODO: Move into the google image extension.
export class GoogleImageField extends ImageField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'google_image'

    // TODO: Change to use the API after the extension is updated to the new
    // Extension style.
    // this._extension_config_promise = this.api.getExtensionConfig(
    //   'extensions.google_cloud_images.GoogleCloudImageExtension')
    this._extension_config_promise = this.api.getExtensionConfig(
      'extensions.editor.EditorExtension')

    // Wait for the config promise to return.
    this._extension_config_promise.then((result) => {
      let previewPrefix = result['googleImagePreviewPrefix']

      // TODO: Remove once grow > 0.8.20
      if (!previewPrefix) {
        console.warn('Hardcoded image preview URL.');
        previewPrefix = 'https://ext-cloud-images-dot-betterplaceforests-website.appspot.com'
      }

      this.previewPrefix = previewPrefix
      document.dispatchEvent(new CustomEvent('selective.render'))
    })
  }

  handleFileInput(evt) {
    if (!this.api) {
      console.error('Missing api for image field.')
      return
    }

    // Wait for the url promise to return.
    this._extension_config_promise.then((result) => {
      let uploadUrl = result['googleImageUploadUrl']

      // TODO: Remove once grow > 0.8.20
      if (!uploadUrl) {
        console.warn('Hardcoded image upload URL.');
        uploadUrl = 'https://ext-cloud-images-dot-betterplaceforests-website.appspot.com/_api/upload_file'
      }

      this.api.saveGoogleImage(evt.target.files[0], uploadUrl).then((result) => {
        this.value = result['url']
        this.previewUrl = result['url']
        document.dispatchEvent(new CustomEvent('selective.render'))
      })
    })
  }

  renderImagePreview(editor, field, data) {
    // Ignore the field values that are resource paths.
    if (field.value && field.value.startsWith('http')) {
      field.previewUrl = field.value
    }

    return super.renderImagePreview(editor, field, data)
  }
}

export class GroupField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'group'
    this.fields = null
    this.isExpanded = false
    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      ${field.updateFromData(data)}
      <div class="selective__field__${field.fieldType}__handle" @click=${field.handleToggleExpand.bind(field)}>
        <i class="material-icons">${field.isExpanded ? 'expand_less' : 'expand_more'}</i>
        <div class="selective__field__${field.fieldType}__label">${field.label}</div>
      </div>
      ${field.renderFields(editor, data)}
    </div>`
  }

  _createFields(editor, data) {
    const fields = new Fields(editor.fieldTypes)
    fields.valueFromData(this.value)

    let fieldConfigs = this.getConfig().get('fields', [])
    const useAutoFields = fieldConfigs.length == 0

    if (useAutoFields) {
      // Auto guess the fields if they are not defined.
      fieldConfigs = new AutoFields(this.value).config['fields']
    }

    for (let fieldConfig of fieldConfigs || []) {
      fieldConfig = autoConfig(fieldConfig, this.extendedConfig)
      fields.addField(fieldConfig, this.extendedConfig)
    }

    return fields
  }

  handleToggleExpand(evt) {
    this.isExpanded = !this.isExpanded
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  renderFields(editor, data) {
    // If the sub fields have not been created create them now.
    if (!this.fields) {
      this.fields = this._createFields(editor, data)
    }

    if (!this.isExpanded) {
      return ''
    }

    return html`<div class="selective__group">
      ${this.fields.template(editor, this.fields, this.value)}
    </div>`
  }
}

// TODO: Use a full markdown editor.
export class MarkdownField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'markdown'

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <textarea id="${field.getUid()}" rows="${field.options.rows || 6}" @input=${field.handleInput.bind(field)}>${field.valueFromData(data) || ' '}</textarea>
    </div>`
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

  _createItems(editor, data) {
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

      const itemFields = new PartialFields(editor.fieldTypes, {
        'partial': partialConfig,
      })
      itemFields.valueFromData(itemData)

      let fieldConfigs = partialConfig.fields
      const useAutoFields = fieldConfigs.length == 0

      if (useAutoFields) {
        // Auto guess the fields if they are not defined.
        fieldConfigs = new AutoFields(itemData, {
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

  renderActionsFooter(editor, field, data) {
    return html`<div class="selective__actions">
      <select class="selective__actions__add" @change=${(evt) => {field.handleAddItem(evt, editor)}}>
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

  renderCollapsedPartial(editor, partialItem) {
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
      </div>
      <div
          class="selective__list__item__delete"
          data-index=${partialItem['index']}
          @click=${this.handleItemDelete.bind(this)}
          title="Delete ${partialItem['partialConfig']['label'] || partialItem['partialKey']}">
        <i class="material-icons">delete</i>
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
      <div class="selective__list__item selective__list__item--${listItem['isExpanded'] ? 'expanded' : listItem['isHidden'] ? 'hidden' : 'collapsed'} ${listItem['useAutoFields'] ? 'selective__list__item--auto' : ''}"
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

export class TextField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'text'

    this.template = (editor, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <input type="text" id="${field.getUid()}" value="${field.valueFromData(data) || ''}" @input=${field.handleInput.bind(field)}>
    </div>`
  }
}

export class TextareaField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
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
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'yaml'
    this.tag = '!g.yaml'
  }
}


export const defaultFields = {
  'document': DocumentField,
  'google_image': GoogleImageField,
  'group': GroupField,
  'image': ImageField,
  'list': ListField,
  'markdown': MarkdownField,
  'partials': PartialsField,
  'text': TextField,
  'textarea': TextareaField,
  'yaml': YamlField,
}
