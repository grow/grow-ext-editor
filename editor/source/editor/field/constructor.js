/**
 * Constructor field types for the editor extension.
 */

import {
  html,
  repeat,
  Field,
  FieldRewrite,
} from 'selective-edit'
import {
  findParentByClassname,
  inputFocusAtEnd,
} from '../../utility/dom'
import {
  createWhiteBlackFilter,
  createValueFilter,
} from '../../utility/filter'

export class ConstructorField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'constructor'
    this.tag = '!g.*'
  }

  handleInput(evt) {
    const locale = evt.target.dataset.locale

    // Constructors are represented as objects in json.
    const value = {
      'value': evt.target.value,
      'tag': this.tag,
    }
    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || {}

    return html`
      <input
        id="${this.uid}${locale}"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value.value || ''} />`
  }
}

export class ConstructorFileField extends ConstructorField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this._showFileList = {}
    this._podPaths = null
    this._listeningForPodPaths = false
    this._filterValue = {}
    this._filterLocaleLatest = ''
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      [],
      // Blacklist.
      [],
    )
  }

  bindListeners(selective) {
    // Bind the field to the pod paths loading.
    if (!this._listeningForPodPaths) {
      this._listeningForPodPaths = true

      // Check if the pod paths are already loaded.
      if (selective.editor._podPaths) {
        handlePodPaths({
          pod_paths: selective.editor._podPaths,
        })
      }

      // Bind even if we have the pod paths so that it updates with changes.
      const handlePodPaths = (response) => {
        this._podPaths = response.pod_paths.sort().filter(this.filterFunc)
        this.render()

        // Wait for the render then focus on the filter input.
        // TODO: Add a listenOnce feature to the listeners with a
        // post render event to trigger focus.
        window.setTimeout(
          () => {
            inputFocusAtEnd(`${this.getUid()}${this._filterLocaleLatest}-filter`)
          },
          25)
      }

      selective.editor.listeners.add('load.podPaths', handlePodPaths)
    }
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

  handleFileClick(evt) {
    const localeTarget = findParentByClassname(
      evt.target, 'selective__field__constructor__file__list')
    const locale = localeTarget.dataset.locale
    const localeKey = this.keyForLocale(locale)
    const podPath = evt.target.dataset.podPath
    const value = {
      tag: this.tag,
      value: podPath,
    }
    this._showFileList[localeKey] = false
    this.setValueForLocale(locale, value)
  }

  handleInputFilter(evt) {
    const locale = evt.target.dataset.locale
    const localeKey = this.keyForLocale(locale)
    this._filterValue[localeKey] = evt.target.value
    this.render()
  }

  handleFilesToggleClick(evt) {
    const locale = evt.target.dataset.locale
    const localeKey = this.keyForLocale(locale)
    this._filterLocaleLatest = locale
    this._showFileList[localeKey] = !(this._showFileList[localeKey] || false)
    this.render()

    // Auto focus on the filter when showing the list.
    if (this._showFileList[localeKey] && this._podPaths) {
      // Wait for the render then focus on the filter input.
      // TODO: Add a listenOnce feature to the listeners with a
      // post render event to trigger focus.
      window.setTimeout(
        () => {
          inputFocusAtEnd(`${this.getUid()}${this._filterLocaleLatest}-filter`)
        },
        25)
    }
  }

  renderFileList(selective, data, locale) {
    const localeKey = this.keyForLocale(locale)
    if (!this._showFileList[localeKey]) {
      return ''
    }

    // If the pod paths have not loaded, show the loading status.
    if (!this._podPaths) {
      // Editor ensures it only loads once.
      selective.editor.loadPodPaths()

      return html`<div class="selective__field__constructor__files">
        <input
          id="${this.getUid()}${locale || ''}-filter"
          type="text"
          @input=${this.handleInputFilter.bind(this)}
          placeholder="Filter..." />
        <div class="selective__field__constructor__file__list" data-locale=${locale || ''}>
          <div class="editor__loading editor__loading--small editor__loading--pad"></div>
        </div>
      </div>`
    }

    let podPaths = this._podPaths

    // Allow the current value to also filter the pod paths.
    if (this._filterValue[localeKey] && this._filterValue[localeKey] != '') {
      podPaths = podPaths.filter(createValueFilter(this._filterValue[localeKey]))
    }

    return html`<div class="selective__field__constructor__files">
      <input type="text"
        id="${this.getUid()}${locale || ''}-filter"
        @input=${this.handleInputFilter.bind(this)}
        placeholder="Filter..." />
      <div class="selective__field__constructor__file__list" data-locale=${locale || ''}>
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

  renderInput(selective, data, locale) {
    this.bindListeners(selective)
    const value = this.getValueForLocale(locale) || {}

    return html`
      <div class="selective__field__constructor__input">
        <input
          id="${this.uid}${locale}"
          placeholder=${this.config.placeholder || ''}
          data-locale=${locale || ''}
          @input=${this.handleInput.bind(this)}
          value=${value.value || ''} />
        <i
            class="material-icons selective__field__constructor__file_icon"
            title="Select pod path"
            data-locale=${locale || ''}
            @click=${this.handleFilesToggleClick.bind(this)}>
          list_alt
        </i>
      </div>
      ${this.renderFileList(selective, data, locale)}`
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
      this.configList('whitelist', [/^\/content\/.*\.yaml$/, /^\/data\/.*\.yaml$/]),
      // Blacklist.
      this.configList('blacklist'),
    )
  }
}
