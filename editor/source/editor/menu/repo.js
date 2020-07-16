/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import moment from 'moment'
import { findParentByClassname } from '../../utility/dom'
import { WORKSPACE_BRANCH_PREFIX } from './workspace'
import MenuBase from './base'


export default class RepoMenu extends MenuBase {
  get template() {
    return (editor, menuState, eventHandlers) => html`<div class="menu__section">
      <div class="menu__repo">
        <div class="menu__repo__label">
          Workspace:
        </div>
        <div class="menu__repo__info">
          ${this.renderBranch(editor, menuState, eventHandlers)}
        </div>
      </div>
    </div>`
  }

  renderBranch(editor, menuState, eventHandlers) {
    editor.loadRepo()

    let lastCommitAuthor = null
    let lastCommitDate = null
    if (menuState.repo) {
      const lastCommit = menuState.repo.commits[0]
      // Need to append the `Z` so that it knows there is no timezone offset.
      lastCommitDate = moment(lastCommit.commit_date + 'Z', moment.ISO_8601)
      lastCommitAuthor = html`<a href="mailto:${lastCommit.author.email}">${lastCommit.author.name}</a>`
    } else {
      return '…'
    }

    return html`
      <div class="menu__repo__workspace menu__repo__value">
        <a
            class="menu__repo__workspace__branch"
            href=${menuState.repo.webUrlForBranch(menuState.repo, menuState.repo.branch)}
            target="_blank">
          ${menuState.repo.cleanBranch(menuState.repo.branch)}
        </a>
        @ <a
            href=${menuState.repo.webUrlForCommit(menuState.repo, menuState.repo.commits[0].sha)}
            target="_blank">
          ${menuState.repo.commits[0].sha.substring(0, 6)}
        </a>
        by ${lastCommitAuthor}
        <span class="menu__repo__time" title="${lastCommitDate.format('D MMM YYYY, h:mm:ss a')}">
          (${lastCommitDate.fromNow()})
        </span>
      </div>`
  }
}
