/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import Selective from 'selective-edit'
import { defaultFields } from '../field'
import { findParentByClassname } from '../../utility/dom'
import MenuBase from './base'


export const SPECIAL_BRANCHES = ['master', 'staging', 'sandbox']
export const WORKSPACE_BRANCH_PREFIX = 'workspace/'


export default class WorkspaceMenu extends MenuBase {
  constructor(config) {
    super(config)

    this.modalWindow = this.config.get('newWorkspaceModal')
  }

  get template() {
    return (editor, menuState, eventHandlers) => html`
      <div class="menu__section">
        <div class="menu__section__title">
          Workspaces
        </div>

        ${this.renderWorkspace(editor, menuState, eventHandlers)}
      </div>`
  }

  _createSelective(workspaces) {
    // Selective editor for the form to add new workspace.
    const newSelective = new Selective(null)
    newSelective.data = {}

    // Add the editor extension default field types.
    for (const key of Object.keys(defaultFields)) {
      newSelective.addFieldType(key, defaultFields[key])
    }

    const options = []
    for (const workspace of workspaces) {
      options.push({
        'label': workspace,
        'value': workspace,
      })
    }

    newSelective.addField({
      'type': 'select',
      'key': 'base',
      'label': 'Parent workspace',
      'help': 'Workspace to create the new workspace from.',
      'options': options
    })

    newSelective.addField({
      'type': 'text',
      'key': 'workspace',
      'label': 'New workspace name',
      'help': 'Can only contain alpha-numeric characters and - (dash).',
    })

    return newSelective
  }

  _getOrCreateSelective(workspaces) {
    if (!this._selective) {
      this._selective = this._createSelective(workspaces)
    }
    return this._selective
  }

  filterBranches(branches) {
    // Give order priority to the special branches.
    const specialWorkspaces = []
    const branchWorkspaces = []

    // Filter down to the workspace branches.
    for (const branch of branches) {
      if (SPECIAL_BRANCHES.includes(branch)) {
        specialWorkspaces.push(branch)
        continue
      }

      if (branch.startsWith(WORKSPACE_BRANCH_PREFIX)) {
        branchWorkspaces.push(branch.slice(WORKSPACE_BRANCH_PREFIX.length))
        continue
      }
    }

    return specialWorkspaces.concat(branchWorkspaces.sort())
  }

  renderWorkspace(editor, menuState, eventHandlers) {
    editor.loadRepo()

    if (!menuState.repo) {
      return html`<div class="editor__loading editor__loading--small" title="Loading..."></div>`
    }

    const workspaces = this.filterBranches(menuState.repo.branches.sort())

    if (this.modalWindow.isOpen) {
      const newWorkspaceSelective = this._getOrCreateSelective(workspaces)

      // Store the selective editor for the new file for processing in the menu.
      this.modalWindow.selective = newWorkspaceSelective

      this.modalWindow.canClickToCloseFunc = () => {
        return newWorkspaceSelective.isClean
      }

      this.modalWindow.contentRenderFunc = () => {
        return newWorkspaceSelective.template(newWorkspaceSelective, newWorkspaceSelective.data)
      }
    }

    return html`<div class="menu__workspace">
        <div class="menu__workspace__add">
          <button class="editor__button editor__actions--add" @click=${eventHandlers.handleWorkspaceNewClick}>New workspace</button>
        </div>
        <div class="menu__workspace__branches">
          ${repeat(workspaces, (branch) => branch, (branch, index) => html`
            <a
                href=${this.urlForBranch(branch)}
                class="menu__workspace__branch">
              <i
                  class="material-icons icon"
                  title="${branch}">
                dashboard
              </i>
              <div class="menu__workspace__branch__label">
                ${branch}
              </div>
            </a>`)}
        </div>
      </div>`
  }

  urlForBranch(branch) {
    if (window.location.hostname == 'localhost') {
      return '#'
    }

    const hostnameParts = window.location.hostname.split('.')
    const baseDomain = hostnameParts.slice(1).join('.')
    const project = hostnameParts[0].split('-')[0]

    return `//${project}-${branch}.${baseDomain}${window.location.pathname}`
  }
}
