/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import {
  createWhiteBlackFilter,
} from '../../utility/filter'
import generateUUID from '../../utility/uuid'
import MenuBase from './base'
import FolderStructure from './folderStructure'


export default class SiteTreeMenu extends MenuBase {
  constructor(config) {
    super(config)

    this.podPath = null
    this.path = null
    this.expandedFolders = []

    this.filterFunc = this.config.get('filterFunc') || createWhiteBlackFilter(
      [/\/content\//, /\/podspec.yaml/],  // Whitelist.
      [],  // Blacklist.
    )
  }

  get template() {
    return (editor, menuState, eventHandlers) => html`
      ${this.renderTree(editor, menuState, eventHandlers)}`
  }

  _addPodPathFolderAsExpanded(podPath, routes) {
    let path = null
    for (const servingPath of Object.keys(routes)) {
      if (routes[servingPath].pod_path == podPath) {
        path = servingPath
        break
      }
    }

    if (!path) {
      return
    }

    this.path = path

    if (path.endsWith('/')) {
      path = path.slice(0, -1)
    }

    let pathParts = path.split('/')
    pathParts.pop()
    const pathFolder = pathParts.join('/')
    if (!this.expandedFolders.includes(pathFolder)) {
      this.expandedFolders.push(pathFolder)
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
    if (!menuState.routes) {
      // Editor handles multiple call resolution.
      editor.loadRoutes()
      return html`<div class="editor__loading" title="Loading..."></div>`
    }

    // Pod path has changed, make sure that the pod path folder is
    // expanded by default. Can still be toggled by clicking folder.
    if (menuState.podPath && this.podPath != menuState.podPath) {
      this.podPath = menuState.podPath
      this._addPodPathFolderAsExpanded(this.podPath, menuState.routes)
    }

    let validPodPaths = []

    for (const path of Object.keys(menuState.routes).sort()) {
      const podPath = menuState.routes[path].pod_path
      validPodPaths.push(podPath)
    }

    validPodPaths = validPodPaths.filter(this.filterFunc)

    const paths = []

    for (const path of Object.keys(menuState.routes).sort()) {
      if (!validPodPaths.includes(menuState.routes[path].pod_path)) {
        continue
      }

      if (path != '/' && path.endsWith('/')) {
        paths.push(path.slice(0, -1))
      } else {
        paths.push(path)
      }
    }

    const folderStructure = new FolderStructure(paths, {}, '/')

    const lookupFunc = (path) => {
      if (menuState.routes[path]) {
        return menuState.routes[path].pod_path
      } else if (menuState.routes[`${path}/`]) {
        return menuState.routes[`${path}/`].pod_path
      }
      return null
    }

    return folderStructure.render(
      this.path,
      this.expandedFolders,
      {
        handleFolderToggle: this.handleFolderToggle.bind(this),
        handleFileClick: this.handleFileClick.bind(this),
      },
      0, // Threshold
      lookupFunc)
  }
}
