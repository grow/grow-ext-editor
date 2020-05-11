/**
 * Customized list field.
 */

import {
  html,
} from 'selective-edit'
import { ListField } from 'selective-edit'
import { ConfirmWindow } from '../parts/modal'
import { findParentByClassname } from '../../utility/dom'

export class EditorListField extends ListField {
  // Add the confirmation for delete to the list field.
  handleDeleteItem(evt) {
    const target = findParentByClassname(evt.target, 'selective__list__item__delete')
    const uid = target.dataset.itemUid
    const locale = target.dataset.locale
    const listItems = this._getListItemsForLocale(locale) || []

    let deleteIndex = -1
    for (const index in listItems) {
      if (listItems[index].uid == uid) {
        deleteIndex = index
        break
      }
    }
    if (deleteIndex < 0) {
      return
    }

    if (!this.confirmDelete) {
      this.confirmDelete = new ConfirmWindow(
        this.render, 'Delete item', 'Delete item')
    }

    this.confirmDelete.contentRenderFunc = () => {
      const preview = this.guessPreview(listItems[deleteIndex], deleteIndex)
      return html`Are you sure you want to delete <strong>${preview}</strong>?`
    }

    this.confirmDelete.promise.then(() => {
      super.handleDeleteItem(evt)
    })

    this.confirmDelete.open()
  }

  renderFooter(selective, data) {
    return html`
      ${super.renderFooter(selective, data)}
      ${this.confirmDelete ? this.confirmDelete.template : ''}`
  }
}
