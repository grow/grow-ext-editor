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
} from 'selective-edit'
import EditorAutoFields from './autoFields'
import { findParentByClassname } from '../utility/dom'
import {
  createWhiteBlackFilter,
  createValueFilter,
} from '../utility/filter'

export class CheckboxField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'checkbox'

    this.template = (selective, field, data) => html`<div
        class="selective__field selective__field__${field.fieldType} ${field.valueFromData(data) ? 'selective__field__checkbox--checked' : ''}"
        data-field-type="${field.fieldType}" @click=${field.handleInput.bind(field)}>
      <div class="selective__field__checkbox__label">${field.label}</div>
      <i class="material-icons">${this.value ? 'check_box' : 'check_box_outline_blank'}</i>
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  handleInput(evt) {
    this.value = !this.value
    document.dispatchEvent(new CustomEvent('selective.render'))
  }
}

export class ConstructorField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'constructor'
    this.tag = '!g.*'

    this.template = (selective, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <div class="selective__field__${field.fieldType}__input">
        <input
          type="text"
          id="${field.getUid()}"
          placeholder="${field.placeholder}"
          value="${field.valueFromData(data)}"
          @input=${field.handleInput.bind(field)}>
      </div>
      ${field.renderHelp(selective, field, data)}
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

export class ConstructorFileField extends ConstructorField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'constructorFile'
    this._showFileList = false
    this._podPaths = null
    this._listeningForPodPaths = false
    this._filterValue = ''
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      [],
      // Blacklist.
      [],
    )

    this.template = (selective, field, data) => html`
    <div
        class="selective__field selective__field__${field.fieldType} ${field._showFileList ? 'selective__field__constructor__input--expanded' : ''}"
        data-field-type="${field.fieldType}">
      ${field.bindListeners(selective)}
      <label for="${field.getUid()}">${field.label}</label>
      <div class="selective__field__constructor__input">
        <input
          type="text"
          id="${field.getUid()}"
          placeholder="${field.placeholder}"
          value="${field.valueFromData(data)}"
          @input=${field.handleInput.bind(field)}>
        <i class="material-icons" @click=${field.handleFilesToggleClick.bind(field)}>list</i>
      </div>
      ${field.renderFileList(selective, data)}
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  bindListeners(selective) {
    // Bind the field to the pod path loading.
    if (!this._listeningForPodPaths) {
      selective.editor.listeners.add('load.podPaths', (response) => {
        this._podPaths = response.pod_paths.sort().filter(this.filterFunc)
        document.dispatchEvent(new CustomEvent('selective.render'))
      })
      this._listeningForPodPaths = true
    }
  }

  handleFilesToggleClick(evt) {
    this._showFileList = !this._showFileList
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  handleFileClick(evt) {
    const podPath = evt.target.dataset.podPath
    this.value = Object.assign({}, this.value, {
      value: podPath,
    })
    this._showFileList = false
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  handleInputFilter(evt) {
    this._filterValue = evt.target.value
    document.dispatchEvent(new CustomEvent('selective.render'))
  }

  renderFileList(selective, data) {
    if (!this._showFileList) {
      return ''
    }

    // If the pod paths have not loaded, show the loading status.
    if (!this._podPaths) {
      // Editor ensures it only loads once.
      selective.editor.loadPodPaths()

      return html`<div class="selective__field__constructor__files">
        <input type="text" @input=${this.handleInputFilter.bind(this)} placeholder="Filter..." />
        <div class="selective__field__constructor__file__list">
          <div class="editor__loading editor__loading--small editor__loading--pad"></div>
        </div>
      </div>`
    }

    let podPaths = this._podPaths

    // Allow the current value to also filter the pod paths.
    if (this._filterValue != '') {
      podPaths = podPaths.filter(createValueFilter(this._filterValue))
    }

    return html`<div class="selective__field__constructor__files">
      <input type="text" @input=${this.handleInputFilter.bind(this)} placeholder="Filter..." />
      <div class="selective__field__constructor__file__list">
      ${repeat(podPaths, (podPath) => podPath, (podPath, index) => html`
        <div
            class="selective__field__constructor__file"
            data-pod-path=${podPath}
            @click=${this.handleFileClick.bind(this)}>
          ${podPath}
        </div>
      `)}
      ${podPaths.length == 0 ? html`
        <div class="selective__field__constructor__file selective__field__constructor__file--empty">
          No matches found.
        </div>` : ''}
      </div>
    </div>`
  }
}

export class DocumentField extends ConstructorFileField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'document'
    this.tag = '!g.doc'
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      [/^\/content\//],
      // Blacklist.
      [],
    )
  }
}

export class ImageField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'image'
    this.previewUrl = ''
    this.isLoading = false

    // Set the api if it was provided
    this.api = this.getConfig().get('api')

    this.template = (selective, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <input
        id="${field.getUid()}"
        type="text"
        placeholder="${field.placeholder}"
        value="${field.valueFromData(data) || ''}"
        @input=${field.handleInput.bind(field)}
        ?disabled="${field.isLoading}">
      <input
        type="file"
        id="${field.getUid()}_file"
        placeholder="Upload new image"
        @change=${field.handleFileInput.bind(field)}
        ?disabled="${field.isLoading}">
      ${field.renderImagePreview(selective, field, data)}
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  renderImagePreview(selective, field, data) {
    if (field.previewUrl == '') {
      return ''
    }

    if (field.isLoading) {
      return html`<div class="selective__field__${field.fieldType}__preview"><div class="editor__loading" title="Loading..."></div></div>`
    }

    // Depends on image element, so needs to run after image has loaded.
    const imageSizeDirective = directive((field) => (part) => {
      setTimeout(() => {
        let el = document.getElementById(`${field.getUid()}_preview`)
        let imageEl = el.querySelector('img')
        const updateImage = (() => {
          part.setValue(`Aspect ratio: ${imageEl.naturalWidth}x${imageEl.naturalHeight}`);
          part.commit();
        })
        // If the image has already loaded.
        imageEl.complete ? updateImage() : imageEl.addEventListener('load', updateImage)
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
      this.isLoading = false
      this.value = result
      this.previewUrl = result
      document.dispatchEvent(new CustomEvent('selective.render'))
    }).catch((err) => {
      this.isLoading = false
      document.dispatchEvent(new CustomEvent('selective.render'))
    })

    this.isLoading = true
    document.dispatchEvent(new CustomEvent('selective.render'))
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
        this.isLoading = false
        document.dispatchEvent(new CustomEvent('selective.render'))
      }).catch((err) => {
        this.isLoading = false
        document.dispatchEvent(new CustomEvent('selective.render'))
      })

      this.isLoading = true
      document.dispatchEvent(new CustomEvent('selective.render'))
    })
  }

  renderImagePreview(selective, field, data) {
    // Ignore the field values that are resource paths.
    if (field.value && field.value.startsWith('http')) {
      field.previewUrl = field.value
    }

    return super.renderImagePreview(selective, field, data)
  }
}

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

// TODO: Use a full markdown editor.
export class MarkdownField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'markdown'

    this.template = (selective, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <textarea
          id="${field.getUid()}"
          rows="${field.getConfig().rows || 6}"
          placeholder="${field.placeholder}"
          @input=${field.handleInput.bind(field)}>
        ${field.valueFromData(data) || ' '}
      </textarea>
      ${field.renderHelp(selective, field, data)}
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

export class SelectField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'select'
    this.threshold = 12

    // Determine which icons to use
    this.useMulti = this.getConfig().get('multi', false)
    this.icons = (this.useMulti
      ? ['check_box_outline_blank', 'check_box']
      : ['radio_button_unchecked', 'radio_button_checked'])

    this.template = (selective, field, data) => html`<div
        class="selective__field selective__field__${field.fieldType} ${field.options.length > field.threshold ? `selective__field__${field.fieldType}--list` : ''}"
        data-field-type="${field.fieldType}" >
      <div class="selective__field__select__label">${field.label}</div>
      <div class="selective__field__select__options">
        ${repeat(field.options, (option) => option.value, (option, index) => html`
          <div class="selective__field__select__value" data-value="${option.value}" @click=${field.handleInput.bind(field)}>
            <div class="selective__field__select__option ${field._isSelected(option.value) ? 'selective__field__select__option--checked' : ''}">
              <i class="material-icons">${field._isSelected(option.value) ? field.icons[1] : field.icons[0] }</i>
              ${option.label || '(None)'}
            </div>
          </div>
        `)}
      </div>
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  _isSelected(optionValue) {
    let value = this.value

    if (!this.useMulti) {
      return value == '' ? optionValue == null : optionValue == value
    }

    // Reset when converting between non-array values.
    if (!Array.isArray(value)) {
      value = []
    }

    return (value || []).includes(optionValue)
  }

  handleInput(evt) {
    const target = findParentByClassname(evt.target, 'selective__field__select__value')
    const value = target.dataset.value == 'null' ? null : target.dataset.value

    if (!this.useMulti) {
      this.value = value
      document.dispatchEvent(new CustomEvent('selective.render'))
      return
    }

    if (!value) {
      return
    }

    // Adjust the list if using multi value
    let newValue = this.value || []

    // Reset when converting between non-array values.
    if (!Array.isArray(newValue)) {
      newValue = []
    }

    if (newValue.includes(value)) {
      newValue = newValue.filter(item => item !== value)
    } else {
      newValue.push(value)
    }
    this.value = newValue
    document.dispatchEvent(new CustomEvent('selective.render'))
  }
}

export class TextField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'text'
    this.threshold = this.getConfig().threshold || 75
    this._isSwitching = false

    this.template = (selective, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      ${field.updateFromData(data)}
      ${field.renderInput(selective, field, data)}
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  handleInput(evt) {
    super.handleInput(evt)

    // Check if the threshold has been reached.
    const isInput = evt.target.tagName.toLowerCase() == 'input'
    if (isInput && this.value.length > this.threshold && !this._isSwitching) {
      // Only trigger switch once.
      this._isSwitching = true

      const id = evt.target.id
      document.dispatchEvent(new CustomEvent('selective.render'))

      // Trigger auto focus after a delay for rendering.
      window.setTimeout(() => {
        const inputEl = document.getElementById(id)
        inputEl.focus()

        // Focus at the end to keep typing.
        inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length
      }, 25)
    }
  }

  renderInput(selective, field, data) {
    // Switch to textarea if the length is long.
    if ((this.value || '').length > this.threshold) {
      return html`
        <textarea
            id="${field.getUid()}"
            rows="${field.getConfig().rows || 6}"
            placeholder="${field.placeholder}"
            @input=${field.handleInput.bind(field)}>${this.value || ' '}</textarea>`
    }

    return html`
      <input
        type="text"
        id="${field.getUid()}"
        value="${this.value || ''}"
        placeholder="${field.placeholder}"
        @input=${field.handleInput.bind(field)}>`
  }
}

export class TextareaField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'textarea'

    this.template = (selective, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <textarea
          id="${field.getUid()}"
          rows="${field.getConfig().rows || 6}"
          placeholder="${field.placeholder}"
          @input=${field.handleInput.bind(field)}>${field.valueFromData(data) || ' '}</textarea>
      ${field.renderHelp(selective, field, data)}
    </div>`
  }
}

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

export class YamlField extends ConstructorFileField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'yaml'
    this.tag = '!g.yaml'
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      [/^\/content\//, /^\/data\//, /\.yaml$/],
      // Blacklist.
      [],
    )
  }
}


export const defaultFields = {
  'checkbox': CheckboxField,
  'document': DocumentField,
  'google_image': GoogleImageField,
  'group': GroupField,
  'image': ImageField,
  'list': ListField,
  'markdown': MarkdownField,
  'partials': PartialsField,
  'select': SelectField,
  'text': TextField,
  'textarea': TextareaField,
  'yaml': YamlField,
}
