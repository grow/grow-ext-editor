/**
 * Utility for creating and controlling modal windows.
 */

import {
  html,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'


export default class ModalWindow {
  constructor(renderFunc) {
    this.isOpen = false
    this.renderFunc = renderFunc
    this.contentRenderFunc = () => ''
    this.clickToClose = true
    this.canClickToCloseFunc = () => this.clickToClose
  }

  get template() {
    if (!this.isOpen) {
      return ''
    }
    return html`
      <div class="modal">
        <div
            class="modal__wrapper"
            @click=${this.handleOffsetClick.bind(this)}>
          <div class="modal__content">
            ${this.contentRenderFunc()}
          </div>
        </div>
      </div>`
  }

  close() {
    this.isOpen = false
    this.renderFunc()
  }

  handleOffsetClick(evt) {
    evt.preventDefault()
    evt.stopPropagation()

    if (!this.clickToClose || !this.canClickToCloseFunc()) {
      return
    }

    // Test if the click was from within the content section.
    const contentParent = findParentByClassname(evt.target, 'modal__content')
    if (contentParent) {
      return
    }

    this.close()
  }

  open() {
    this.isOpen = true
    this.renderFunc()
  }

  toggle() {
    this.isOpen = !this.isOpen
    this.renderFunc()
  }
}
