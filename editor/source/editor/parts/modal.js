/**
 * Utility for creating and controlling modal windows.
 */

import {
  html,
  repeat,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import Defer from '../../utility/defer'
import generateUUID from '../../utility/uuid'


export default class ModalWindow {
  constructor(renderFunc, title) {
    this.isOpen = false
    this.renderFunc = renderFunc
    this.title = title
    this.contentRenderFunc = () => ''
    this.clickToClose = true
    this.canClickToCloseFunc = () => this.clickToClose
    this.actions = []
  }

  get actionsTemplate() {
    if (!this.actions.length) {
      return ''
    }

    return html`${repeat(this.actions, (action) => action.uid, (action, index) => html`
      <button
          class="editor__button ${action.classes}"
          @click=${action.callback}>
        ${action.label}
      </button>
    `)}`
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
          <div class="modal__container">
            ${this.title ? html`<h2>${this.title}</h2>` : ''}
            <div class="modal__content">
              ${this.contentRenderFunc()}
            </div>
            <div class="modal__actions">
              ${this.actionsTemplate}
            </div>
          </div>
        </div>
      </div>`
  }

  addAction(label, callback, isPrimary, isSecondary) {
    const classes = []

    if (isPrimary) {
      classes.push('editor__button--primary')
    }

    if (isSecondary) {
      classes.push('editor__button--secondary')
    }

    this.actions.push({
      uid: generateUUID(),
      label: label,
      callback: callback,
      classes: classes,
      isPrimary: isPrimary,
      isSecondary: isSecondary,
    })
  }

  close() {
    this.isOpen = false
    this.renderFunc()
  }

  handleOffsetClick(evt) {
    evt.preventDefault()
    evt.stopPropagation()

    if (!this.canClickToCloseFunc()) {
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

export class ConfirmWindow extends ModalWindow {
  constructor(renderFunc, title, submitLabel, cancelLabel) {
    super(renderFunc, title)

    this.result = new Defer()

    this.addAction(
      submitLabel || 'Confirm', () => { this.result.resolve() }, true)
    this.addAction(
      cancelLabel || 'Cancel', () => { this.result.reject() })
  }

  get promise() {
    return this.result.promise
  }
}
