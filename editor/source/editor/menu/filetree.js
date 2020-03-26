/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import generateUUID from '../../utility/uuid'
import MenuBase from './base'


export default class FileTreeMenu extends MenuBase {
  constructor(config) {
    super(config)

    this.podPath = null
    this.expandedFolders = []
  }

  get template() {
    return (editor, menuState, eventHandlers) => html`
      ${this.renderTree(editor, menuState, eventHandlers)}`
  }

  _addPodPathFolderAsExpanded(podPath) {
    let podPathParts = podPath.split('/')
    podPathParts.pop()

    const podPathFolder = podPathParts.join('/')
    if (!this.expandedFolders.includes(podPathFolder)) {
      this.expandedFolders.push(podPathFolder)
    }
  }

  handleFileClick(evt) {
    const podPath = evt.target.dataset.podPath
    document.dispatchEvent(new CustomEvent('selective.path.update', {
      detail: {
        path: podPath,
      }
    }))
  }

  handleFolderToggle(evt) {
    const target = findParentByClassname(evt.target, 'menu__tree__folder__label')
    const folder = target.dataset.folder
    if (this.expandedFolders.includes(folder)) {
      this.expandedFolders = this.expandedFolders.filter(item => item !== folder)
    } else {
      this.expandedFolders.push(folder)
    }
    this.render()
  }

  renderTree(editor, menuState, eventHandlers) {
    if (!menuState.podPaths) {
      // Editor handles multiple call resolution.
      editor.loadPodPaths()
      return html`<div class="editor__loading" title="Loading..."></div>`
    }

    // Pod path has changed, make sure that the pod path folder is
    // expanded by default. Can still be toggled by clicking folder.
    if (menuState.podPath && this.podPath != menuState.podPath) {
      this.podPath = menuState.podPath
      this._addPodPathFolderAsExpanded(this.podPath)
    }

    const folderStructure = new FolderStructure(menuState.podPaths, '/')

    return folderStructure.render(
      this.podPath,
      this.expandedFolders,
      {
        handleFolderToggle: this.handleFolderToggle.bind(this),
        handleFileClick: this.handleFileClick.bind(this),
      })
  }
}

class FolderStructure {
  constructor(podPaths, folder, folderBase) {
    this.uid = generateUUID()
    this.folderInfo = {
      folder: folder || '/',
      folderBase: folderBase,
      folders: [],
      files: [],
    }

    let prefix = this.folderInfo.folder

    // Make sure the prefix ends with a /.
    if (!prefix.endsWith('/')) {
      prefix += '/'
    }

    const subFolders = []

    for (const podPath of podPaths) {
      if (podPath.startsWith(prefix)) {
        const subPath = podPath.slice(prefix.length)
        const subPathParts = subPath.split('/')
        if (subPathParts.length > 1) {
          const subFolder = subPathParts[0]
          if (subFolders.includes(subFolder)) {
            continue
          }

          subFolders.push(subFolder)
          this.folderInfo.folders.push(
            new FolderStructure(podPaths, `${prefix}${subFolder}`, subFolder))
        } else {
          const fileName = subPathParts[0]
          const fileExt = fileName.split('.').pop()
          const fileBase = fileName.slice(0, fileName.length - fileExt.length - 1)
          this.folderInfo.files.push({
            fileName: fileName,
            fileBase: fileBase,
            fileExt: fileExt,
          })
        }
      }
    }
  }

  render(podPath, expandedFolders, eventHandlers) {
    const folder = this.folderInfo.folder
    const level = folder == '/' ? 0 : folder.split('/').length - 1
    const classes = ['menu__tree__folder']
    const isExpanded = level <= 1 || expandedFolders.includes(folder)
    const threshold = 1
    const filePrefix = `${folder == '/' ? '' : folder}/`

    if (!isExpanded) {
      classes.push('menu__tree__folder--collapsed')
    }

    return html`<div class=${classes.join(' ')}>
      ${level > threshold
        ? html`
          <div class="menu__tree__folder__label" data-folder=${folder} @click=${eventHandlers.handleFolderToggle}>
            <i class="material-icons">${isExpanded ? 'expand_more' : 'expand_less'}</i>
            ${this.folderInfo.folderBase}
          </div>`
        : ''}
      <div class=${level > threshold ? 'menu__tree__folder__level' : ''}>
        <div class=${level > threshold ? 'menu__tree__folder__folder' : ''}>
          ${repeat(this.folderInfo.folders, (folder) => folder.uid, (folder, index) => html`
            ${folder.render(podPath, expandedFolders, eventHandlers)}`)}
        </div>
        <div class=${level > threshold ? 'menu__tree__folder__files' : ''}>
          ${repeat(this.folderInfo.files, (file) => `${filePrefix}${file.fileName}`, (file, index) => html`
            <div
                class="menu__tree__folder__file ${podPath == `${filePrefix}${file.fileName}`
                  ? 'menu__tree__folder__file--selected'
                  : ''}"
                data-pod-path=${`${filePrefix}${file.fileName}`}
                @click=${eventHandlers.handleFileClick}>
              <i class="material-icons">notes</i>
              ${file.fileBase}
            </div>`)}
        </div>
      </div>
    </div>`
  }
}
