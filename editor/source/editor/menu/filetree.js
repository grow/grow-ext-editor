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
import FolderStructure from './folderStructure'


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
    const target = findParentByClassname(evt.target, 'menu__tree__folder__file')
    const podPath = target.dataset.podPath
    document.dispatchEvent(new CustomEvent('selective.path.update', {
      detail: {
        path: podPath,
      }
    }))
  }

  handleFileCopyClick(evt) {
    evt.stopPropagation()
    const target = findParentByClassname(evt.target, 'menu__tree__folder__file')
    const podPath = target.dataset.podPath
    document.dispatchEvent(new CustomEvent('selective.path.copy', {
      detail: {
        path: podPath,
      }
    }))
  }

  handleFileDeleteClick(evt) {
    evt.stopPropagation()
    const target = findParentByClassname(evt.target, 'menu__tree__folder__file')
    const podPath = target.dataset.podPath
    document.dispatchEvent(new CustomEvent('selective.path.delete', {
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
    if (!menuState.podPaths || !menuState.templates) {
      // Editor handles multiple call resolution.
      editor.loadPodPaths()
      editor.loadTemplates()
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
        handleFileCopyClick: this.handleFileCopyClick.bind(this),
        handleFileDeleteClick: this.handleFileDeleteClick.bind(this),
      },
      1)
  }
}
