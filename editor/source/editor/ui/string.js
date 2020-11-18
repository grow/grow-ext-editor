/**
 * UI elements for the working with string files.
 */

import {
  html,
  repeat,
} from 'selective-edit'
import DataType from '../../utility/dataType'
import { autoDeepObject } from '../../utility/deepObject'
import {
  findParentByClassname,
  inputFocusAtEnd,
} from '../../utility/dom'
import {
  createIncludeExcludeFilter,
  createValueFilter,
  filterObject,
} from '../../utility/filter'
import {
  FileListUI,
} from '../ui/file'


export class StringListUI extends FileListUI {
  constructor(config) {
    super(config)

    this._listeningForStrings = false
  }

  bindListeners(selective) {
    // Bind the field to the pod paths loading.
    if (!this._listeningForStrings) {
      this._listeningForStrings = true

      // Check if the pod paths are already loaded.
      if (selective.editor._strings) {
        this.handleStrings({
          strings: selective.editor._strings,
        })
      }

      // Bind to the load event to listen for future changes to the strings.
      selective.editor.listeners.add('load.strings', this.handleStrings.bind(this))
    }
  }

  handleFileClick(evt) {
    const localeTarget = findParentByClassname(evt.target, 'selective__file_list__list')
    const dataTarget = findParentByClassname(evt.target, 'selective__file_list__file')
    const locale = localeTarget.dataset.locale
    const podPath = dataTarget.dataset.podPath
    const key = dataTarget.dataset.key
    const filename = podPath.split('/').pop()
    const filebase = filename.replace(/.y[a]?ml$/i, '')
    const reference = `${filebase}.${key}`

    this.showFileList = false
    this.listeners.trigger('podPath', reference, locale)
  }

  handleStrings(response) {
    this.podPaths = response.strings
    // TODO: filter the keys using the filter function.
    // .sort().filter(this.filterFunc)
    this.delayedFocus()
    this.render()
  }

  isValueValidReference(reference) {
    return Boolean(this.valueFromReference(reference))
  }

  _partsFromReference(reference) {
    if (!reference || !this.podPaths) {
      return null
    }

    const referenceParts = reference.split('.')

    // String references need at least 2 parts: filebase and key.
    if (referenceParts.length < 2) {
      return null
    }

    const filebase = referenceParts.shift()
    const podPath = `/content/strings/${filebase}.yaml`

    return {
      'podPath': podPath,
      'reference': referenceParts.join('.'),
    }
  }

  renderFiles(selective, data, locale) {
    let podPaths = this.podPaths

    // Filter the pod paths information to filter by value in the keys and value.
    if (this.filterValue && this.filterValue != '') {
      podPaths = filterObject(
        podPaths, createValueFilter(this.filterValue), true) || {}
    }

    return html`<div class="selective__file_list">
      ${this.renderFilterInput(selective, data, locale)}
      <div class="selective__file_list__list selective__file_list__list--grouped" data-locale=${locale || ''}>
        ${repeat(Object.keys(podPaths), (podPath) => podPath, (podPath, index) => html`
          <div
              class="selective__file_list__group">
            ${podPath}
          </div>
          ${this.renderStringsDeep(selective, podPath, podPaths[podPath])}
        `)}
        ${Object.keys(podPaths).length == 0 ? html`
          <div class="selective__file_list__file selective__file_list__file--empty">
            No matches found.
          </div>` : ''}
      </div>
    </div>`
  }

  renderStringsDeep(selective, podPath, value, keys) {
    keys = keys || []

    if (DataType.isObject(value)) {
      return html`
        ${repeat(Object.keys(value).sort(), (key) => (keys.concat([key])).join('_'), (key, index) => html`
          ${this.renderStringsDeep(selective, podPath, value[key], keys.concat([key]))}
        `)}`
    } else {
      return html`
        <div
            class="selective__file_list__file"
            data-pod-path=${podPath}
            data-key=${keys.join('.')}
            @click=${this.handleFileClick.bind(this)}>
          <div class="selective__file_list__file__key">
            ${keys.join('.')}
          </div>
          <div class="selective__file_list__file__value">
            ${value}
          </div>
        </div>`
    }
  }

  triggerLoad(selective) {
    // Editor ensures it only loads once.
    selective.editor.loadStrings()
  }

  valueFromReference(reference) {
    if (!this.podPaths) {
      return null
    }

    const parts = this._partsFromReference(reference)

    if (!parts) {
      return null
    }

    if (!this.podPaths[parts.podPath]) {
      return null
    }

    const deepValue = autoDeepObject(this.podPaths[parts.podPath])
    return deepValue.get(parts.reference)
  }
}
