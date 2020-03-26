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


export default class RepoMenu extends MenuBase {
  get template() {
    return (editor, menuState, eventHandlers) => html`<div class="menu__section">
      <div class="menu__repo">
        <div class="menu__repo__info">
          ${this.renderBranch(editor, menuState, eventHandlers)}
        </div>
      </div>
    </div>`
  }

  renderBranch(editor, menuState, eventHandlers) {
    editor.loadRepo()

    return html`
      <div class="menu__repo__label">
        Branch:
      </div>
      <div class="menu__repo__name">
        ${ menuState.repo
          ? html`
            <a
                href=${menuState.repo.web_url}
                target="_blank">
              ${menuState.repo.branch} @ ${menuState.repo.commits[0].sha.substring(0, 6)}
            </a>`
          : html`…`}
      </div>`
  }
}
