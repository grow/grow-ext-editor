/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import MenuBase from './base'


const SPECIAL_BRANCHES = ['master', 'staging', 'sandbox']
const WORKSPACE_BRANCH_PREFIX = 'workspace/'


export default class WorkspaceMenu extends MenuBase {
  get template() {
    return (editor, menuState, eventHandlers) => html`
      <div class="menu__section">
        <div class="menu__section__title">
          Workspaces
        </div>

        ${this.renderWorkspace(editor, menuState, eventHandlers)}
      </div>`
  }

  renderWorkspace(editor, menuState, eventHandlers) {
    editor.loadRepo()

    if (!menuState.repo) {
      return html`<div class="editor__loading editor__loading--small" title="Loading..."></div>`
    }

    const specialWorkspaces = []
    const branchWorkspaces = []

    // Filter down to the workspace branches.
    for (const branch of menuState.repo.branches.sort()) {
      if (SPECIAL_BRANCHES.includes(branch)) {
        specialWorkspaces.push(branch)
        continue
      }

      if (branch.startsWith(WORKSPACE_BRANCH_PREFIX)) {
        branchWorkspaces.push(branch.slice(WORKSPACE_BRANCH_PREFIX.length))
        continue
      }
    }

    branchWorkspaces.sort()

    const workspaces = specialWorkspaces.concat(branchWorkspaces)

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
