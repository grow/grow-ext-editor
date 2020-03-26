/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import Listeners from '../../utility/listeners'
import MenuBase from './base'


export default class SubMenu extends MenuBase {
  constructor(config) {
    super(config)

    this.items = this.config.get('items', [])
    this.selected = this.storage.getItem('selective.menu.tree') || this.items[0]
    this.listeners = new Listeners()
  }

  get template() {
    // Do not show when the length is not long enough.
    if (!this.items.length < 2) {
      return (editor) => ''
    }

    return (editor) => html`
      <div class="menu__section">
        <div class="menu__sub_menu">
          ${repeat(this.items, (item) => item, (item, index) => html`
            <div
                class="menu__sub_menu__item ${this.selected == item ? 'menu__sub_menu__item--selected' : ''}"
                data-item=${item}
                @click=${this.handleChange.bind(this)}>
              ${item}
            </div>`)}
        </div>
      </div>`
  }

  handleChange(evt) {
    this.selected = evt.target.dataset.item
    this.storage.setItem('selective.menu.tree', this.selected)
    this.listeners.trigger('change', this.selected)
    this.render()
  }
}
