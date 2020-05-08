/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import Selective from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import { defaultFields } from '../field'
import generateUUID from '../../utility/uuid'
import MenuBase from './base'
import FolderStructure from './folderStructure'
import ModalWindow from '../parts/modal'
import { ConfirmWindow } from '../parts/modal'


export default class FileTreeMenu extends MenuBase {
  constructor(config) {
    super(config)

    this.podPath = null
    this.expandedFolders = []
    this.newFileFolder = null
    this._selectives = {}

    this.modalWindow = new ModalWindow(this.render, 'New page')
    this.modalWindow.addAction(
      'Create file', this.handleFileNewSubmit.bind(this), true)
    this.modalWindow.addAction(
      'Cancel', this.handleFileNewCancel.bind(this), false, true)

    this.confirmDelete = null
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

  _createSelective(templates) {
    // Selective editor for the form to add new file.
    const newSelective = new Selective(null)
    newSelective.data = {}

    // Add the editor extension default field types.
    for (const key of Object.keys(defaultFields)) {
      newSelective.addFieldType(key, defaultFields[key])
    }

    newSelective.addField({
      'type': 'text',
      'key': 'fileName',
      'label': 'File name',
      'help': 'May also be used for the url stub.',
    })

    const keys = Object.keys(templates || {}).sort()
    const options = [{
      'label': html`
        <div class="menu__tree__new__template__option">
          <div class="menu__tree__new__template__option__label">
            <h3>Empty page</h3>
          </div>
        </div>`,
      'value': '',
    }]

    for (const key of keys) {
      const template = templates[key]
      let screenshots = ''

      if (template.screenshots) {
        const resolutions = Object.keys(template.screenshots).sort()
        screenshots = html`
          <div class="menu__tree__new__template__option__screenshots">
            ${repeat(resolutions, (resolution) => resolution, (resolution, index) => html`
              <img src="${template.screenshots[resolution].serving_url}">
            `)}
          </div>`
      }

      options.push({
        'label': html`
          <div class="menu__tree__new__template__option">
            <div class="menu__tree__new__template__option__label">
              <h3>${template.label}</h3>
            </div>
            ${screenshots}
            <div class="menu__tree__new__template__option__description">
              ${template.description}
            </div>
          </div>`,
        'value': key,
      })
    }

    // Only add template if there are templates.
    if (options.length > 1) {
      newSelective.addField({
        'type': 'select',
        'key': 'template',
        'label': 'Template',
        'help': 'Template to base the new file off of.',
        'options': options
      })
    }

    return newSelective
  }

  _getOrCreateSelective(folder, templates) {
    if (!this._selectives[folder]) {
      if (!templates) {
        console.error('Unable to create selective editor without templates.')
      }
      this._selectives[folder] = this._createSelective(templates)
    }
    return this._selectives[folder]
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

    this.confirmDelete = new ConfirmWindow(
      this.render, 'Delete page', 'Delete page')
    this.confirmDelete.contentRenderFunc = () => {
      return html`Are you sure you want to delete the page at <strong>${podPath}</strong>?`
    }

    this.confirmDelete.promise.then(() => {
      document.dispatchEvent(new CustomEvent('selective.path.delete', {
        detail: {
          path: podPath,
        }
      }))
    })

    this.confirmDelete.open()
  }

  handleFileNewCancel(evt) {
    evt.stopPropagation()
    this.newFileFolder = null
    this.modalWindow.close()
  }

  handleFileNewClick(evt) {
    evt.stopPropagation()

    const target = findParentByClassname(evt.target, 'menu__tree__folder__directory')
    const folder = target.dataset.folder
    this.newFileFolder = folder
    this.modalWindow.open()
  }

  handleFileNewSubmit(evt) {
    evt.stopPropagation()

    const newFileSelective = this._getOrCreateSelective(this.newFileFolder)
    const value = newFileSelective.value

    document.dispatchEvent(new CustomEvent('selective.path.template', {
      detail: {
        collectionPath: this.newFileFolder,
        fileName: value.fileName,
        template: value.template,
      }
    }))
    this.modalWindow.close()
  }

  handleFolderToggle(evt) {
    const target = findParentByClassname(evt.target, 'menu__tree__folder__directory')
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

    const folderStructure = new FolderStructure(menuState.podPaths, menuState.templates, '/')

    if (this.newFileFolder) {
      const templates = menuState.templates[this.newFileFolder]
      const newFileSelective = this._getOrCreateSelective(this.newFileFolder, templates)

      this.modalWindow.canClickToCloseFunc = () => {
        return newFileSelective.isClean
      }

      this.modalWindow.contentRenderFunc = () => {
        return newFileSelective.template(newFileSelective, newFileSelective.data)
      }
    }

    return html`${folderStructure.render(
      this.podPath,
      this.expandedFolders,
      {
        handleFolderToggle: this.handleFolderToggle.bind(this),
        handleFileClick: this.handleFileClick.bind(this),
        handleFileCopyClick: this.handleFileCopyClick.bind(this),
        handleFileDeleteClick: this.handleFileDeleteClick.bind(this),
        handleFileNewClick: this.handleFileNewClick.bind(this),
      },
      1)}
      ${this.modalWindow.template}
      ${this.confirmDelete ? this.confirmDelete.template : ''}`
  }
}
