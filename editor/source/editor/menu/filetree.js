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
import { defaultValidationRules } from '../validation'
import generateUUID from '../../utility/uuid'
import MenuBase from './base'
import FolderStructure from './folderStructure'
import { ConfirmWindow } from '../parts/modal'


export default class FileTreeMenu extends MenuBase {
  constructor(config) {
    super(config)

    this.podPath = null
    this.expandedFolders = []
    this._selectiveCopyFile = null
    this._selectivesNewFile = {}

    this.deleteFileWindow = this.config.get('deleteFileModal')
    this.newFileWindow = this.config.get('newFileModal')
    this.copyFileWindow = this.config.get('copyFileModal')
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

  _createSelectiveCopyFile(podPaths, podPath) {
    // Selective editor for the form to add new file.
    const newSelective = new Selective(null)
    newSelective.data = {
      podPath: podPath,
      fileName: podPath,
    }

    // Add the editor default field types.
    newSelective.addFieldTypes(defaultFields)

    // Add the editor default validation types.
    newSelective.addRuleTypes(defaultValidationRules)

    // The new file should match the extension of the old file.
    let originalExt = 'yaml'
    if (podPath.endsWith('.html')) {
      originalExt = 'html'
    } else if (podPath.endsWith('.md')) {
      originalExt = 'md'
    }

    newSelective.addField({
      'type': 'text',
      'key': 'fileName',
      'label': 'File name',
      'help': `Copy '${podPath}' to this new file.`,
      'validation': [
        {
          'type': 'required',
          'message': 'File name is required.',
        },
        {
          'type': 'pattern',
          'pattern': '^[a-z0-9-_\.\/]*$',
          'message': 'File name can only contain lowercase alpha-numeric characters, . (period), _ (underscore), / (forward slash), and - (dash).',
        },
        {
          'type': 'pattern',
          'pattern': '/[a-z0-9]+[^/]*$',
          'message': 'File name in the sub directory needs to start with alpha-numeric characters.',
        },
        {
          'type': 'pattern',
          'pattern': '^/content/[a-z0-9]+/',
          'message': 'File name needs to be in a collection (ex: /content/pages/).',
        },
        {
          'type': 'pattern',
          'pattern': `^.*\.(${originalExt})$`,
          'message': `File name needs to end with ".${originalExt}" to match the original file.`,
        },
        {
          'type': 'match',
          'excluded': {
            'values': podPaths,
            'message': 'File name already exists.',
          },
        },
      ],
    })

    return newSelective
  }

  _createSelectiveNewFile(templates) {
    // Selective editor for the form to add new file.
    const newSelective = new Selective(null)
    newSelective.data = {}

    // Add the editor default field types.
    newSelective.addFieldTypes(defaultFields)

    // Add the editor default validation types.
    newSelective.addRuleTypes(defaultValidationRules)

    newSelective.addField({
      'type': 'text',
      'key': 'fileName',
      'label': 'File name',
      'help': 'May also be used for the url stub.',
      'validation': [
        {
          'type': 'required',
          'message': 'File name is required.',
        },
        {
          'type': 'pattern',
          'pattern': '^[a-z0-9-_\.]*$',
          'message': 'File name can only contain lowercase alpha-numeric characters, . (period), _ (underscore) and - (dash).',
        },
        {
          'type': 'pattern',
          'pattern': '^[a-z0-9]+',
          'message': 'File name can only start with an alpha-numeric character.',
        },
        {
          'type': 'pattern',
          'pattern': '^.*\.(yaml|md|html)$',
          'message': 'File name needs to end with ".yaml", ".md", or ".html".',
        },
      ],
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

  _getOrCreateSelectiveCopyFile(podPaths, podPath) {
    if (!this._selectiveCopyFile) {
      this._selectiveCopyFile = this._createSelectiveCopyFile(podPaths, podPath)
    }
    return this._selectiveCopyFile
  }

  _getOrCreateSelectiveNewFile(folder, templates) {
    if (!this._selectivesNewFile[folder]) {
      if (!templates) {
        console.error('Unable to create selective editor without templates.')
      }
      this._selectivesNewFile[folder] = this._createSelectiveNewFile(templates)
    }
    return this._selectivesNewFile[folder]
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
    // Reset the selective form so that it can be regenerated.
    this._selectiveCopyFile = null
    this.copyFileWindow.podPath = podPath
    this.copyFileWindow.open()
  }

  handleFileDeleteClick(evt) {
    evt.stopPropagation()
    const target = findParentByClassname(evt.target, 'menu__tree__folder__file')
    const podPath = target.dataset.podPath

    this.deleteFileWindow.podPath = podPath
    this.deleteFileWindow.contentRenderFunc = () => {
      return html`Are you sure you want to delete the page at <strong>${podPath}</strong>?`
    }
    this.deleteFileWindow.open()
  }

  handleFileNewClick(evt) {
    evt.stopPropagation()

    const target = findParentByClassname(evt.target, 'menu__tree__folder__actions')
    const folder = target.dataset.folder
    this.newFileWindow.newFileFolder = folder
    this.newFileWindow.open()
  }

  handleFolderToggle(evt) {
    const target = findParentByClassname(evt.target, 'menu__tree__folder__directory')
    const folder = target.dataset.folder
    if (this.expandedFolders.includes(folder)) {
      this.expandedFolders = this.expandedFolders.filter(item => item !== folder)
    } else {
      this.expandedFolders.push(folder)
    }
    evt.preventDefault()
    evt.stopPropagation()
    this.render()
  }

  renderTree(editor, menuState, eventHandlers) {
    if (!menuState.podPaths || !menuState.templates) {
      // Editor handles multiple call resolution.
      editor.loadPodPaths()
      editor.loadTemplates()
      return html`<div class="editor__loading editor__loading--small" title="Loading..."></div>`
    }

    // Pod path has changed, make sure that the pod path folder is
    // expanded by default. Can still be toggled by clicking folder.
    if (menuState.podPath && this.podPath != menuState.podPath) {
      this.podPath = menuState.podPath
      this._addPodPathFolderAsExpanded(this.podPath)
    }

    const folderStructure = new FolderStructure(menuState.podPaths, menuState.templates, '/')

    if (this.copyFileWindow.podPath) {
      const copyFileSelective = this._getOrCreateSelectiveCopyFile(menuState.podPaths, this.copyFileWindow.podPath)

      // Store the selective editor for the new file for processing in the menu.
      this.copyFileWindow.selective = copyFileSelective

      this.copyFileWindow.canClickToCloseFunc = () => {
         return copyFileSelective.isClean
      }

      this.copyFileWindow.contentRenderFunc = () => {
         return copyFileSelective.template(copyFileSelective, copyFileSelective.data)
      }
    }

    if (this.newFileWindow.newFileFolder) {
      const templates = menuState.templates[this.newFileWindow.newFileFolder]
      const newFileSelective = this._getOrCreateSelectiveNewFile(this.newFileWindow.newFileFolder, templates)

      // Store the selective editor for the new file for processing in the menu.
      this.newFileWindow.selective = newFileSelective

      this.newFileWindow.canClickToCloseFunc = () => {
        return newFileSelective.isClean
      }

      this.newFileWindow.contentRenderFunc = () => {
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
      1)}`
  }
}
