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
import {
  MenuWindow,
} from '../parts/modal'
import ModalWindow from '../parts/modal'
import MenuBase from './base'
import RepoMenu from './repo'
import SiteMenu from './site'
import WorkspaceMenu from './workspace'


export default class Menu extends MenuBase {
  constructor(config, editor) {
    super(config)
    this.editor = editor
    this.menuWindow = new MenuWindow()
    // this.menuWindow.isOpen = true  // TODO: Remove

    // Create the delete page modal outside of the modal for the menu.
    // Otherwise, the delete modal is constrained to the menu modal.
    this.deleteFileWindow = new ModalWindow('Delete page')
    this.deleteFileWindow.addAction(
      'Delete file', this.handleFileDeleteSubmit.bind(this), true)
    this.deleteFileWindow.addAction(
      'Cancel', this.handleFileDeleteCancel.bind(this), false, true)

    // Create the new page modal outside of the modal for the menu.
    // Otherwise, the new modal is constrained to the menu modal.
    this.newFileWindow = new ModalWindow('New page')
    this.newFileWindow.addAction(
      'Create file', this.handleFileNewSubmit.bind(this), true, null,
      this.handleFileNewDisabled.bind(this))
    this.newFileWindow.addAction(
      'Cancel', this.handleFileNewCancel.bind(this), false, true)

    // Create the new workspace modal outside of the modal for the menu.
    // Otherwise, the new modal is constrained to the menu modal.
    this.newWorkspaceWindow = new ModalWindow('New workspace')
    this.newWorkspaceWindow.addAction(
      'Create workspace', this.handleWorkspaceNewSubmit.bind(this), true, null,
      this.handleWorkspaceNewDisabled.bind(this))
    this.newWorkspaceWindow.addAction(
      'Cancel', this.handleWorkspaceNewCancel.bind(this), false, true)

    this._repoMenu = new RepoMenu({
      testing: this.isTesting,
    })
    this._siteMenu = new SiteMenu({
      deleteFileModal: this.deleteFileWindow,
      newFileModal: this.newFileWindow,
      testing: this.isTesting,
    })
    this._workspaceMenu = new WorkspaceMenu({
      newWorkspaceModal: this.newWorkspaceWindow,
      testing: this.isTesting,
    })
    this._state = {
      pod: null,
      podPath: editor.podPath,
      podPaths: null,
      repo: null,
      routes: null,
      templates: null,
      trees: {
        file: {
          isOpen: this.storage.getItem('selective.menu.tree.file.open') == 'true'
        },
        site: {
          isOpen: this.storage.getItem('selective.menu.tree.site.open') == 'true'
        },
      },
    }

    this.filterFunc = this.config.get('filterFunc') || createWhiteBlackFilter(
      [/^\/content\//, /^\/data\//],  // Whitelist.
      [],  // Blacklist.
    )

    this.bindEvents()
  }

  get template() {
    return (editor) => html`<div class="menu">
      ${this.renderMenuBar(editor)}
      ${this.renderMenu(editor)}
    </div>`
  }

  bindEvents() {
    this.editor.listeners.add('podPath', this.handlePodPathChange.bind(this))
    this.editor.listeners.add('load.pod', this.handlePodChange.bind(this))
    this.editor.listeners.add('load.podPaths', this.handleLoadPodPaths.bind(this))
    this.editor.listeners.add('load.repo', this.handleLoadRepo.bind(this))
    this.editor.listeners.add('load.routes', this.handleLoadRoutes.bind(this))
    this.editor.listeners.add('load.templates', this.handleLoadTemplates.bind(this))

    // Close the menu when updating the path.
    document.addEventListener('selective.path.update', (evt) => {
      this.menuWindow.close()
    })
  }

  handleFileDeleteCancel(evt) {
    evt.stopPropagation()
    this.deleteFileWindow.close()
  }

  handleFileDeleteSubmit(evt) {
    evt.stopPropagation()
    const podPath = this.deleteFileWindow.podPath
    console.log('pod path: ', podPath);
    document.dispatchEvent(new CustomEvent('selective.path.delete', {
      detail: {
        path: podPath,
      }
    }))
    this.deleteFileWindow.close()
  }

  handleFileNewCancel(evt) {
    evt.stopPropagation()
    this.newFileWindow.newFileFolder = null
    this.newFileWindow.close()
  }

  handleFileNewDisabled() {
    // Only do disabled when the selective for the window is defined.
    if (!this.newFileWindow.selective) {
      return false
    }
    return !this.newFileWindow.selective.isValid
  }

  handleFileNewSubmit(evt) {
    evt.stopPropagation()

    const value = this.newFileWindow.selective.value

    document.dispatchEvent(new CustomEvent('selective.path.template', {
      detail: {
        collectionPath: this.newFileWindow.newFileFolder,
        fileName: value.fileName,
        template: value.template,
      }
    }))
    this.newFileWindow.close()
  }

  handleLoadPodPaths(response) {
    this._state.podPaths = response.pod_paths.sort().filter(this.filterFunc)
    this.render()
  }

  handleLoadRepo(response) {
    this._state.repo = response.repo
    this.render()
  }

  handleLoadRoutes(response) {
    this._state.routes = response.routes
    this.render()
  }

  handleLoadTemplates(response) {
    this._state.templates = response.templates
    this.render()
  }

  handlePodChange(response) {
    this._state.pod = response.pod
    this.render()
  }

  handlePodPathChange(podPath) {
    this._state.podPath = podPath
  }

  handleToggleMenu(evt) {
    this.menuWindow.toggle()
  }

  handleToggleTree(evt) {
    const target = findParentByClassname(evt.target, 'menu__tree__title')
    const tree = target.dataset.tree
    const isOpen = !this._state.trees[tree].isOpen
    this._state.trees[tree].isOpen = isOpen
    this.storage.setItem(`selective.menu.tree.${tree}.open`, isOpen)
    this.render()
  }

  handleWorkspaceNewCancel(evt) {
    evt.stopPropagation()
    this.newWorkspaceWindow.close()
  }

  handleWorkspaceNewDisabled() {
    // Only do disabled when the selective for the window is defined.
    if (!this.newWorkspaceWindow.selective) {
      return false
    }
    return !this.newWorkspaceWindow.selective.isValid
  }

  handleWorkspaceNewSubmit(evt) {
    evt.stopPropagation()

    // Do not do anything when the form is invalid.
    if (!this.newWorkspaceWindow.selective.isValid) {
      return
    }

    const value = this.newWorkspaceWindow.selective.value

    document.dispatchEvent(new CustomEvent('editor.workspace.new', {
      detail: {
        base: value.base,
        workspace: value.workspace,
      }
    }))

    this.newWorkspaceWindow.close()
  }

  renderMenu(editor) {
    // Always show the menu when there is not a pod path.
    const hasPodPath = Boolean(editor.podPath && editor.podPath != '')

    if (!hasPodPath) {
      this.menuWindow.isOpen = true
    }

    const isOpen = this.menuWindow.isOpen

    if (!this._state.pod) {
      editor.loadPod()
    }

    if (isOpen) {
      this.menuWindow.contentRenderFunc = () => {
        return html`
          <div class="menu__contents">
            <div class="menu__section">
              <div class="menu__site">
                <div class="menu__site__title">
                  ${this._state.pod ? this._state.pod.title : ''}
                </div>
                <i class="material-icons" @click=${this.handleToggleMenu.bind(this)} title="Close menu">
                  close
                </i>
              </div>
            </div>
            ${this.config.enableMenuWorkspace ? this._workspaceMenu.template(editor, this._state, {
              handleWorkspaceNewClick: () => { this.newWorkspaceWindow.open() },
            }) : ''}
            ${this._siteMenu.template(editor, this._state, {
              handleToggleTree: this.handleToggleTree.bind(this),
            })}
          </div>`
      }
    }

    return html`
      ${this.menuWindow.template}
      ${this.deleteFileWindow.template}
      ${this.newFileWindow.template}
      ${this.newWorkspaceWindow.template}`
  }

  renderMenuBar(editor) {
    if (!this._state.pod) {
      editor.loadPod()
    }

    return html`
      <div class="menu__bar">
        <div class="menu__bar__section">
          <div
              class="menu__hamburger"
              @click=${this.handleToggleMenu.bind(this)}
              title="Open menu">
            <i class="material-icons">menu</i>
          </div>
          <div class="menu__bar__title">
            ${this._state.pod ? this._state.pod.title : ''}
          </div>
        </div>
        <div class="menu__bar__section">
          ${this._repoMenu.template(editor, this._state, {})}
        </div>
      </div>`
  }
}
