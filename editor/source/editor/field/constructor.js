/**
 * Constructor field types for the editor extension.
 */

import {
  html,
  repeat,
  Field,
} from 'selective-edit'
import {
  inputFocusAtEnd,
} from '../../utility/dom'
import {
  createWhiteBlackFilter,
  createValueFilter,
} from '../../utility/filter'

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
          value="${field.valueFromData(data) || ''}"
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
          value="${field.valueFromData(data) || ''}"
          @input=${field.handleInput.bind(field)}>
        <i class="material-icons" title="Select pod path" @click=${field.handleFilesToggleClick.bind(field)}>list_alt</i>
      </div>
      ${field.renderFileList(selective, data)}
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  configList(listKey, defaults) {
    const list = []
    const rawList = this.getConfig().get(listKey, [])
    for (const value of rawList) {
      list.push(new RegExp(value, 'gi'))
    }

    if (!list.length) {
      return defaults || []
    }

    return list
  }

  bindListeners(selective) {
    // Bind the field to the pod path loading.
    if (!this._listeningForPodPaths) {
      this._listeningForPodPaths = true

      const handlePodPaths = (response) => {
        this._podPaths = response.pod_paths.sort().filter(this.filterFunc)
        document.dispatchEvent(new CustomEvent('selective.render'))
        window.setTimeout(
          () => { inputFocusAtEnd(`${this.getUid()}-filter`) },
          25)
      }

      // Check if the pod paths are already loaded.
      if (selective.editor._podPaths) {
        handlePodPaths({
          pod_paths: selective.editor._podPaths,
        })
      }

      selective.editor.listeners.add('load.podPaths', handlePodPaths)
    }
  }

  handleFilesToggleClick(evt) {
    this._showFileList = !this._showFileList
    document.dispatchEvent(new CustomEvent('selective.render'))

    // Auto focus on the filter when showing the list.
    if (this._showFileList) {
      window.setTimeout(
        () => { inputFocusAtEnd(`${this.getUid()}-filter`) },
        25)
    }
  }

  handleFileClick(evt) {
    const podPath = evt.target.dataset.podPath
    this.value = Object.assign({}, this.value, {
      value: podPath,
      tag: this.tag,
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
        <input
          id="${this.getUid()}-filter"
          type="text"
          @input=${this.handleInputFilter.bind(this)}
          placeholder="Filter..." />
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
      <input type="text"
        id="${this.getUid()}-filter"
        @input=${this.handleInputFilter.bind(this)}
        placeholder="Filter..." />
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
      this.configList('whitelist', [/^\/content\//]),
      // Blacklist.
      this.configList('blacklist'),
    )
  }
}

export class YamlField extends ConstructorFileField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'yaml'
    this.tag = '!g.yaml'
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      this.configList('whitelist', [/^\/content\//, /^\/data\//, /\.yaml$/]),
      // Blacklist.
      this.configList('blacklist'),
    )
  }
}
