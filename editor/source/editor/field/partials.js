/**
 * Partials field types for the editor extension.
 */

import {
  autoConfig,
  html,
  repeat,
  ListField,
  ListItem,
} from 'selective-edit'
import {
  findParentByClassname,
} from '../../utility/dom'
import PartialsFields from '../fields/fields'
import EditorAutoFields from '../autoFields'
import ModalWindow from '../parts/modal'

export class PartialsField extends ListField {
  constructor(ruleTypes, config, globalConfig) {
    super(ruleTypes, config, globalConfig)
    this.fieldType = 'partials'
    this.partialTypes = null
    this.api = this.config.get('api')
    this.api.getPartials().then(this.handleLoadPartialsResponse.bind(this))
    this.modalWindow = new ModalWindow(this.config.addLabel || 'Add partial')
  }

  _createFields(fieldTypes, config, partialKey) {
    return new PartialsFields(fieldTypes, this.ruleTypes, config, partialKey)
  }

  get fullKey() {
    const parentKey = this.config.get('parentKey')
    if (parentKey) {
      return `${parentKey}.${this.key}`
    }
    return this.key
  }

  getPartialConfig(partialKey) {
    if (!this.partialTypes) {
      return {}
    }

    return this.partialTypes[partialKey] || {}
  }

  handleLoadPartialsResponse(response) {
    const partialTypes = {}

    // Sorted objects for the partials.
    const partialKeys = Object.keys(response['partials']).sort()
    for (const key of partialKeys) {
      const newPartial = response['partials'][key]
      newPartial['key'] = key
      partialTypes[key] = newPartial
    }

    this.partialTypes = partialTypes
    this.render()

    // Check for missing screenshots.
    for (const partialKey of Object.keys(this.partialTypes)) {
      const partial = this.partialTypes[partialKey]
      if (partial.examples) {
        for (const exampleKey of Object.keys(partial.examples)) {
          const screenshots = partial.screenshots[exampleKey] || {}

          // Missing screenshot. Request it.
          if (!Object.keys(screenshots).length) {
            this.api.screenshotPartial(partialKey, exampleKey).then((response) => {
              if (!this.partialTypes[partialKey].screenshots) {
                this.partialTypes[partialKey].screenshots = {}
              }
              this.partialTypes[partialKey].screenshots[exampleKey] = response[partialKey][exampleKey]
              this.render()
            })
          }
        }
      }
    }
  }

  _createItems(selective, data, locale) {
    const value = this.getValueForLocale(locale) || []
    const localeKey = this.keyForLocale(locale)
    let listItems = this._getListItemsForLocale(locale)

    if (listItems != null || !value.length || !this.partialTypes) {
      return
    }

    listItems = []

    const AutoFieldsCls = this.config.get('AutoFieldsCls', EditorAutoFields)
    const ListItemCls = this.config.get('ListItemCls', ListItem)

    for (const itemData of value) {
      const partialKey = itemData.partial
      const partialConfig = this.getPartialConfig(partialKey)

      const fields = this._createFields(
        selective.fieldTypes, {}, partialKey)
      fields.label = partialConfig.label || partialKey
      fields.updateOriginal(selective, itemData)

      // Use the partial key to find the field configs.
      let fieldConfigs = partialConfig.fields || []
      this._useAutoFields = !fieldConfigs.length

      // Auto guess the fields if they are not defined.
      if (this._useAutoFields) {
        fieldConfigs = new AutoFieldsCls(itemData).config['fields']
      }

      // Create the fields based on the config.
      for (let fieldConfig of fieldConfigs || []) {
        fieldConfig = autoConfig(fieldConfig, this.globalConfig)

        // Add the partial key as part of the parent key.
        fieldConfig.set('parentKey', `${this.fullKey}.${partialKey}`)

        // Mark the auto fields.
        if (this._useAutoFields) {
          fieldConfig.set('isGuessed', true)
        }

        fields.addField(fieldConfig, this.globalConfig)
      }

      // When an is not expanded it does not get the value
      // updated correctly so we need to manually call the data update.
      for (const field of fields.fields) {
        field.updateOriginal(selective, itemData || fields.defaultValue)
      }

      listItems.push(new ListItemCls(partialConfig, fields))
    }

    this._setListItemsForLocale(locale, listItems)

    // Trigger a new render to make sure the expand/collapse buttons show.
    if (listItems.length > 1) {
      this.render()
    }
  }

  handleAddItem(evt, selective) {
    this.modalWindow.close()
    const target = findParentByClassname(evt.target, `selective__partials__gallery__item`)
    const partialKey = target.dataset.partialKey

    if (!partialKey) {
      return
    }

    const partialConfig = this.getPartialConfig(partialKey)
    const locale = evt.target.dataset.locale
    const listItems = this._getListItemsForLocale(locale) || []
    const fields = this._createFields(
      selective.fieldTypes, {}, partialKey)
    fields.label = partialConfig.label || partialKey

    // Use the field config for the list items to create the correct field types.
    let fieldConfigs = partialConfig.fields || []

    // If no field configs, use the last item config if availble.
    if (!fieldConfigs.length && listItems.length > 0) {
      fieldConfigs = listItems[listItems.length-1].config.fields
    }

    // Create the fields based on the config.
    for (let fieldConfig of fieldConfigs || []) {
      fieldConfig = autoConfig(fieldConfig, this.globalConfig)

      // Add the partial key as part of the parent key.
      fieldConfig.set('parentKey', `${this.fullKey}.${partialKey}`)

      // Mark the auto fields.
      if (this._useAutoFields) {
        fieldConfig.set('isGuessed', true)
      }

      fields.addField(fieldConfig, this.globalConfig)
    }

    fields.updateOriginal(selective, fields.defaultValue)

    const listItem = new ListItem(partialConfig, fields)
    listItem.isExpanded = true
    listItems.push(listItem)

    this._setListItemsForLocale(locale, listItems)
    this.render()
  }

  handleTogglePartialList() {
    this.modalWindow.toggle()
  }

  renderActionsFooter(selective, data, locale) {
    if (!this.partialTypes) {
      return ''
    }

    if (!this.modalWindow.isOpen) {
      const renderScreenshots = (screenshots) => {
        const screenshotKeys = Object.keys(screenshots).sort()
        if (!screenshotKeys) {
          return ''
        }
        return html`
          <div class="selective__partials__gallery__preview">
            ${repeat(screenshotKeys, (key) => key, (key, index) => html`
              ${repeat(Object.keys(screenshots[key]), (resolutionKey) => `${key}-${resolutionKey}`, (resolutionKey, index) => html`
                <img src="${screenshots[key][resolutionKey].serving_url}">
              `)}
            `)}
          </div>`
      }

      // Sort the partials by the label, not the key.
      const partialLabelToKey = {}
      for (const key of Object.keys(this.partialTypes)) {
        // Make the sort case insensitive.
        const partialLabel = (this.partialTypes[key].label || this.partialTypes[key].key).toLowerCase()
        partialLabelToKey[partialLabel] = key
      }
      const sortedPartialKeys = []
      for (const label of Object.keys(partialLabelToKey).sort()) {
        sortedPartialKeys.push(partialLabelToKey[label])
      }

      this.modalWindow.contentRenderFunc = () => {
        return html`
          <div class="selective__partials__gallery">
            ${repeat(sortedPartialKeys, (key) => key, (key, index) => html`
              <div
                  class="selective__partials__gallery__item"
                  data-partial-key=${this.partialTypes[key].key}
                  @click=${(evt) => {this.handleAddItem(evt, selective)}}>
                <div class="selective__partials__gallery__details">
                  <h3>${this.partialTypes[key].label || this.partialTypes[key].key}</h3>
                  ${this.partialTypes[key].description
                    ? html`<p>${this.partialTypes[key].description}</p>`
                    : ''}
                </div>
                ${renderScreenshots(this.partialTypes[key].screenshots)}
              </div>`)}
          </div>`
      }
    }

    return html`
      ${this.modalWindow.template}
      <div class="selective__actions">
        <button
            class="selective__button selective__button--add"
            @click=${this.handleTogglePartialList.bind(this)}>
          ${this.config.add_label || 'Add partial'}
        </button>
      </div>`
  }

  renderPreview(selective, data, item, index, locale) {
    const parts = []
    const partialLabel = item.config.label || item.config.key || 'Partial'
    const previewLabel = this.guessPreview(item, index, ' ').trim()

    parts.push(html`<div
        class="selective__list__item__label"
        data-item-uid=${item.uid}
        data-locale=${locale || ''}
        @click=${this.handleExpandItem.bind(this)}>
      ${partialLabel}
    </div>`)

    if (previewLabel) {
      parts.push(html`
        <div
            class="selective__list__item__preview"
            data-item-uid=${item.uid}
            data-locale=${locale || ''}
            @click=${this.handleExpandItem.bind(this)}>
          ${previewLabel}
        </div>`)
    }

    return parts
  }
}
