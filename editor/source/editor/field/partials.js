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
import EditorAutoFields from '../autoFields'

export class PartialsField extends ListField {
  constructor(config, globalConfig) {
    super(config, globalConfig)
    this.fieldType = 'partials'
    this.partialTypes = null
    this.api = this.config.get('api')
    this.api.getPartials().then(this.handleLoadPartialsResponse.bind(this))
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
  }

  _createItems(selective, data, locale) {
    const value = this.getValueForLocale(locale) || []
    const localeKey = this.keyForLocale(locale)
    const listItems = this._getListItemsForLocale(locale)

    if (listItems.length > 0 || !value.length || !this.partialTypes) {
      return
    }

    const AutoFieldsCls = this.config.get('AutoFieldsCls', EditorAutoFields)
    const ListItemCls = this.config.get('ListItemCls', ListItem)

    for (const itemData of value) {
      const partialKey = itemData.partial
      const partialConfig = this.getPartialConfig(partialKey)

      const fields = this._createFields(selective.fieldTypes)
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
        fields.addField(fieldConfig, this.globalConfig)
      }

      // When an is not expanded it does not get the value
      // updated correctly so we need to manually call the data update.
      for (const field of fields.fields) {
        field.updateOriginal(selective, itemData || fields.defaultValue)
      }

      listItems.push(new ListItemCls(partialConfig, fields))
    }
  }

  handleAddItem(evt, selective) {
    const partialKey = evt.target.value

    if (!partialKey) {
      return
    }

    const partialConfig = this.getPartialConfig(partialKey)
    const locale = evt.target.dataset.locale
    const listItems = this._getListItemsForLocale(locale)
    const fields = this._createFields(selective.fieldTypes)
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
      fields.addField(fieldConfig, this.globalConfig)
    }

    fields.updateOriginal(fields.defaultValue)

    const listItem = new ListItem(partialConfig, fields)
    listItem.isExpanded = true
    listItems.push(listItem)

    this._setListItemsForLocale(locale, listItems)

    // Reset the value for the select field to allow easily selecting another.
    evt.target.value = ''

    this.render()
  }

  renderActionsFooter(selective, data, locale) {
    if (!this.partialTypes) {
      return ''
    }

    return html`<div class="selective__actions">
      <select class="selective__actions__add" @change=${(evt) => {this.handleAddItem(evt, selective)}}>
        <option value="">${this.config.addLabel || 'Add partial'}</option>
        ${repeat(Object.entries(this.partialTypes), (item) => item[0], (item, index) => html`
          <option value="${item[1]['key']}">${item[1]['label']}</option>
        `)}
      </select>
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
