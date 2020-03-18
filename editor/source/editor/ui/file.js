/**
 * UI elements for the working with files.
 */

import {
  html,
  repeat,
  UI,
} from 'selective-edit'
import {
  findParentByClassname,
  inputFocusAtEnd,
} from '../../utility/dom'
import {
  createWhiteBlackFilter,
  createValueFilter,
} from '../../utility/filter'


export class FileListUI extends UI {
  constructor(config) {
    super()

    this.setConfig(config)

    this.filterFunc = this.config.get('filterFunc') || createWhiteBlackFilter(
      [],  // Whitelist.
      [],  // Blacklist.
    )

    this.podPaths = null
    this.filterValue = ''

    this._listeningForPodPaths = false
    this._showFileList = false
  }

  renderFilterInput(selective, data, locale) {
    return html`
      <input
        id="${this.uid}-filter"
        type="text"
        @input=${this.handleInputFilter.bind(this)}
        placeholder="Filter..." />`
  }

  renderFileList(selective, data, locale) {
    this.bindListeners(selective)

    if (!this._showFileList) {
      return ''
    }

    // If the pod paths have not loaded, show the loading status.
    if (!this.podPaths) {
      // Editor ensures it only loads once.
      selective.editor.loadPodPaths()

      return html`<div class="selective__file_list">
        ${this.renderFilterInput(selective, data, locale)}
        <div class="selective__file_list__list" data-locale=${locale || ''}>
          <div class="editor__loading editor__loading--small editor__loading--pad"></div>
        </div>
      </div>`
    }

    let podPaths = this.podPaths

    // Allow the current value to also filter the pod paths.
    if (this.filterValue && this.filterValue != '') {
      podPaths = podPaths.filter(createValueFilter(this.filterValue))
    }

    return html`<div class="selective__file_list">
      ${this.renderFilterInput(selective, data, locale)}
      <div class="selective__file_list__list" data-locale=${locale || ''}>
        ${repeat(podPaths, (podPath) => podPath, (podPath, index) => html`
          <div
              class="selective__file_list__file"
              data-pod-path=${podPath}
              @click=${this.handleFileClick.bind(this)}>
            ${podPath}
          </div>
        `)}
        ${podPaths.length == 0 ? html`
          <div class="selective__file_list__file selective__file_list__file--empty">
            No matches found.
          </div>` : ''}
      </div>
    </div>`
  }

  bindListeners(selective) {
    // Bind the field to the pod paths loading.
    if (!this._listeningForPodPaths) {
      this._listeningForPodPaths = true

      // Check if the pod paths are already loaded.
      if (selective.editor._podPaths) {
        this.handlePodPaths({
          pod_paths: selective.editor._podPaths,
        })
      }

      // Bind to the load event to listen for future changes to the pod paths.
      selective.editor.listeners.add('load.podPaths', this.handlePodPaths.bind(this))
    }
  }

  delayedFocus() {
    // Wait for the render then focus on the filter input.
    // TODO: Add a listenOnce feature to the listeners with a
    // post render event to trigger focus.
    window.setTimeout(
      () => {
        inputFocusAtEnd(`${this.uid}-filter`)
      },
      25)
  }

  handleFileClick(evt) {
    const localeTarget = findParentByClassname(evt.target, 'selective__file_list__list')
    const locale = localeTarget.dataset.locale
    const podPath = evt.target.dataset.podPath
    this._showFileList = false
    this.listeners.trigger('podPath', podPath, locale)
  }

  handleInputFilter(evt) {
    this.filterValue = evt.target.value
    this.render()
  }

  handlePodPaths(response) {
    this.podPaths = response.pod_paths.sort().filter(this.filterFunc)
    this.render()
    this.delayedFocus()
  }

  toggle() {
    this._showFileList = !this._showFileList
    this.render()
    if(this._showFileList) {
      this.delayedFocus()
    }
  }
}
