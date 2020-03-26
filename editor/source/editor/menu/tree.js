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
import SubMenu from './submenu'
import FileTreeMenu from './filetree'
import SiteTreeMenu from './sitetree'


export default class TreeMenu extends MenuBase {
  constructor(config) {
    super(config)

    this._subMenu = new SubMenu({
      testing: this.isTesting,
      items: [
        'Filetree',
        // 'Sitemap',
      ],
      storageKey: 'selective.menu.tree',
    })
    this._fileTreeMenu = new FileTreeMenu({
      testing: this.isTesting,
    })
    this._siteTreeMenu = new SiteTreeMenu({
      testing: this.isTesting,
    })
    this.selected = this._subMenu.selected
    this._subMenu.listeners.add('change', this.handleSubMenuSwitch.bind(this))
  }

  get template() {
    return (editor, menuState, eventHandlers) => html`
      ${this._subMenu.template(editor)}
      ${this.renderTree(editor, menuState, eventHandlers)}`
  }

  handleSubMenuSwitch(selected) {
    this.selected = selected
    this.render()
  }

  renderTree(editor, menuState, eventHandlers) {
    let treeClass = ''
    let treeMenu = null

    switch (this.selected) {
      case 'Filetree':
        treeClass = 'menu__tree__filetree'
        treeMenu = this._fileTreeMenu
        break
      case 'Sitemap':
        treeClass = 'menu__tree__sitemap'
        treeMenu = this._siteTreeMenu
        break
    }

    return html`
      <div class="menu__section">
        <div class="menu__trees">
          <div class="menu__tree ${treeClass}">
            ${treeMenu.template(editor, menuState, eventHandlers)}
          </div>
        </div>
      </div>`
  }
}
