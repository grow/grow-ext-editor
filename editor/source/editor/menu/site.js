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


export default class SiteMenu extends MenuBase {
  constructor(config) {
    super(config)
    this._isOpen = this.storage.getItem('selective.menu.open') == 'true'
  }

  get template() {
    return (editor, menuState, eventHandlers) => html`<div class="menu__section">
      <div class="menu__site">
        <div class="menu__site__title">${this.renderSiteTitle(editor, menuState, eventHandlers)}</div>
        <i class="material-icons" @click=${eventHandlers.toggleMenu} title="Close menu">
          close
        </i>
      </div>
    </div>`
  }

  renderSiteTitle(editor, menuState, eventHandlers) {
    if (!menuState.pod) {
      editor.loadPod()
      return 'Site'
    }

    return menuState.pod.title
  }
}
