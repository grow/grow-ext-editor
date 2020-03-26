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


export default class SiteTreeMenu extends MenuBase {
  get template() {
    return (editor, menuState, eventHandlers) => html`sitetree`
  }
}
