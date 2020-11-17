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
import BasePart from './base'


const disabledNoOp = () => false


export default class ModalWindow extends BasePart {
  constructor(title) {
    super()
    this.isOpen = false
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
          @click=${action.callback}
          ?disabled=${action.callbackDisabled()}>
        ${action.label}
      </button>
    `)}`
  }

  get classesMain() {
    return ['modal']
  }

  get template() {
    if (!this.isOpen) {
      return ''
    }
    return html`
      <div class=${this.classesMain}>
        <div
            class="modal__wrapper"
            @click=${this.handleOffsetClick.bind(this)}
            @keydown=${this.handleOffsetKeyboard.bind(this)}>
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

  addAction(label, callback, isPrimary, isSecondary, callbackDisabled) {
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
      callbackDisabled: callbackDisabled || disabledNoOp,
      classes: classes,
      isPrimary: isPrimary,
      isSecondary: isSecondary,
    })
  }

  close() {
    this.isOpen = false
    this.render()
  }

  handleOffsetClick(evt) {
    if (!this.canClickToCloseFunc()) {
      return
    }

    // Test if the click was from within the content section.
    const contentParent = findParentByClassname(evt.target, 'modal__container')
    if (contentParent) {
      return
    }

    evt.preventDefault()
    evt.stopPropagation()

    this.close()
  }

  handleOffsetKeyboard(evt) {
    if (!this.canClickToCloseFunc()) {
      return
    }

    // Allow escaping out of modal.
    if (event.key == 'Escape') {
      this.close()
    }
  }

  open() {
    this.isOpen = true
    this.render()
  }

  toggle() {
    this.isOpen = !this.isOpen
    this.render()
  }
}

export class ConfirmWindow extends ModalWindow {
  constructor(title, submitLabel, cancelLabel) {
    super(title)

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

export class MenuWindow extends ModalWindow {
  get classesMain() {
    const superClasses = super.classesMain
    superClasses.push('modal--menu')
    return superClasses.join(' ')
  }
}
