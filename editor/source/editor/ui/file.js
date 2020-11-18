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
  createIncludeExcludeFilter,
  createValueFilter,
} from '../../utility/filter'


export class FileListUI extends UI {
  constructor(config) {
    super(config)

    this.filterFunc = this.config.get('filterFunc') || createIncludeExcludeFilter(
      [],  // Included.
      [],  // Excluded.
    )

    this.podPaths = null
    this.filterValue = ''

    this._listeningForPodPaths = false
    this.showFileList = false
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
    document.addEventListener('selective.render.complete', () => {
      inputFocusAtEnd(`${this.uid}-filter`)
    }, {
      once: true,
    })
  }

  handleFileClick(evt) {
    const localeTarget = findParentByClassname(evt.target, 'selective__file_list__list')
    const locale = localeTarget.dataset.locale
    const podPath = evt.target.dataset.podPath
    this.showFileList = false
    this.listeners.trigger('podPath', podPath, locale)
  }

  handleInputFilter(evt) {
    this.filterValue = evt.target.value
    this.render()
  }

  handlePodPaths(response) {
    this.podPaths = response.pod_paths.sort().filter(this.filterFunc)
    this.delayedFocus()
    this.render()
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

    if (!this.showFileList) {
      return ''
    }

    // If the pod paths have not loaded, show the loading status.
    if (!this.podPaths) {
      this.triggerLoad(selective)
      return this.renderLoading(selective, data, locale)
    }

    return this.renderFiles(selective, data, locale)
  }

  renderFiles(selective, data, locale) {
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

  renderLoading(selective, data, locale) {
    return html`<div class="selective__file_list">
      ${this.renderFilterInput(selective, data, locale)}
      <div class="selective__file_list__list" data-locale=${locale || ''}>
        <div class="editor__loading editor__loading--small editor__loading--pad"></div>
      </div>
    </div>`
  }

  toggle() {
    this.showFileList = !this.showFileList
    if(this.showFileList) {
      this.delayedFocus()
    }
    this.render()
  }

  triggerLoad(selective) {
    // Editor ensures it only loads once.
    selective.editor.loadPodPaths()
  }
}
