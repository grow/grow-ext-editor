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


export default class FileTreeMenu extends MenuBase {
  constructor(config) {
    super(config)

    this.podPath = null
    this.expandedFolders = []
    this.modalWindow = new ModalWindow(this.render)
    this.newFileFolder = null
    this._selectives = {}
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
    document.dispatchEvent(new CustomEvent('selective.path.delete', {
      detail: {
        path: podPath,
      }
    }))
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

    const target = findParentByClassname(evt.target, 'menu__tree__new__template')
    const folder = target.dataset.folder
    const value = this._getOrCreateSelective(folder).value

    document.dispatchEvent(new CustomEvent('selective.path.template', {
      detail: {
        collectionPath: folder,
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
      this.modalWindow.contentRenderFunc = () => {
        const templates = menuState.templates[this.newFileFolder]
        const newFileSelective = this._getOrCreateSelective(this.newFileFolder, templates)
        this.modalWindow.canClickToCloseFunc = () => {
          return newFileSelective.isClean
        }

        return html`
          <div class="menu__tree__new__template" data-folder=${this.newFileFolder}>
            <h2>New page</h2>
            ${newFileSelective.template(newFileSelective, newFileSelective.data)}
            <div class="menu__tree__new__template__actions">
              <button
                  class="editor__button editor__button--primary"
                  @click=${this.handleFileNewSubmit.bind(this)}>
                Create file
              </button>
              <button
                  class="editor__button editor__button--secondary"
                  @click=${this.handleFileNewCancel.bind(this)}>
                Cancel
              </button>
            </div>
          </div>`
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
      ${this.modalWindow.template}`
  }
}
