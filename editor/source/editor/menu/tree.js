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
import FileTreeMenu from './filetree'
import SiteTreeMenu from './sitetree'


export default class TreeMenu extends MenuBase {
  constructor(config) {
    super(config)

    this._fileTreeMenu = new FileTreeMenu({
      deleteFileModal: this.config.get('deleteFileModal'),
      newFileModal: this.config.get('newFileModal'),
      testing: this.isTesting,
    })
    this._siteTreeMenu = new SiteTreeMenu({
      deleteFileModal: this.config.get('deleteFileModal'),
      newFileModal: this.config.get('newFileModal'),
      testing: this.isTesting,
    })
  }

  get template() {
    return (editor, menuState, eventHandlers) => html`
      ${this.renderTree(editor, menuState, eventHandlers)}`
  }

  handleSubMenuSwitch(selected) {
    this.selected = selected
    this.render()
  }

  renderTree(editor, menuState, eventHandlers) {
    return html`
      <div class="menu__trees">
        <div class="menu__tree">
          <div
              class="menu__tree__title"
              data-tree="file"
              @click=${eventHandlers.handleToggleTree}>
            <i class="material-icons">${menuState.trees.file.isOpen ? 'expand_more' : 'expand_less'}</i>
            Collections
          </div>
          <div class="menu__tree__tree" data-tree="file">
            ${menuState.trees.file.isOpen ? this._fileTreeMenu.template(editor, menuState, eventHandlers) : ''}
          </div>
        </div>
        <div class="menu__tree">
          <div
              class="menu__tree__title"
              data-tree="site"
              @click=${eventHandlers.handleToggleTree}>
            <i class="material-icons">${menuState.trees.site.isOpen ? 'expand_more' : 'expand_less'}</i>
            Sitemap
          </div>
          <div class="menu__tree__tree" data-tree="site">
            ${menuState.trees.site.isOpen ? this._siteTreeMenu.template(editor, menuState, eventHandlers) : ''}
          </div>
        </div>
      </div>`
  }
}
