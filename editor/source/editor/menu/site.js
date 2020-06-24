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
import TreeMenu from './tree'


export default class SiteMenu extends MenuBase {
  constructor(config) {
    super(config)

    this._treeMenu = new TreeMenu({
      newFileModal: this.config.get('newFileModal'),
      testing: this.isTesting,
    })
  }

  get template() {
    return (editor, menuState, eventHandlers) => html`
      <div class="menu__section">
        <div class="menu__section__title">
          Site
        </div>
        ${this._treeMenu.template(editor, menuState, eventHandlers)}
      </div>`
  }

  renderSiteTitle(editor, menuState, eventHandlers) {
    if (!menuState.pod) {
      editor.loadPod()
      return '…'
    }

    return menuState.pod.title
  }
}
