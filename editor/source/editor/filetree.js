/**
 *  File tree utility.
 */

import {
  html,
  repeat,
} from 'selective-edit'
import Config from '../utility/config'
import { findParentByClassname } from '../utility/dom'

export default class FileTree {
  constructor(documents, config) {
    this.documents = documents
    this.config = new Config(config)
    this.search = ''

    this.template = (fileTree) => html`<div class="editor__filetree">
      ${repeat(fileTree.treeRows, (row) => row.id, (row, index) => html`
        <div class="editor__filetree__row"
            data-pod-path="${row.podPath}"
            @click=${fileTree.handleRowClick.bind(fileTree)}>
          ${row['path']}
        </div>
      `)}
    </div>`
  }

  _isBlacklisted(path, blacklists) {
    for (const ignoredPathRe of blacklists) {
      if (ignoredPathRe.test(path)) {
        return true
      }
    }
    return false
  }

  _isWhitelisted(path, whitelists) {
    // No whitelists is all whitelisted.
    if (!whitelists.length) {
      return true
    }

    for (const onlyPathRe of whitelists) {
      if (onlyPathRe.test(path)) {
        return true
      }
    }
    return false
  }

  _sectionTemplates(sections) {
    const parts = []
    const totalSections = sections.length

    for (let i = 0; i < totalSections; i++) {
      parts.push(html`<span class="editor__filetree__section editor__filetree__section--${i + 1 == totalSections ? 'leaf' : 'node'}">${sections[i]}</span>`)
    }

    return parts
  }

  get documents() {
    return this._documents
  }

  get treeRows() {
    const rows = []
    for (const path of this.paths) {
      // Check the serving path lists.
      if (
          !this._isWhitelisted(path, this.config.get('whitelistPaths', []))
          || this._isBlacklisted(path, this.config.get('blacklistPaths', []))) {
        continue
      }

      const docInfo = this.documents[path]

      // Check the pod path lists.
      if (
          !this._isWhitelisted(docInfo['pod_path'], this.config.get('whitelistPodPaths', []))
          || this._isBlacklisted(docInfo['pod_path'], this.config.get('blacklistPodPaths', []))) {
        continue
      }

      const rowInfo = {
        id: path,
        podPath: docInfo['pod_path'],
        path: path,
        sections: path.split('/'),
      }

      // TODO: Filter using the search criteria.

      rows.push(rowInfo)
    }
    return rows
  }

  set documents(value) {
    this._documents = value
    this.paths = Object.keys(value).sort()
  }

  handleRowClick(evt) {
    const target = findParentByClassname(evt.target, 'editor__filetree__row')
    const podPath = target.dataset.podPath

    // Trigger that the pod path should update.
    document.dispatchEvent(new CustomEvent('selective.path.update', {
      detail: {
        path: podPath,
      }
    }))
  }
}
