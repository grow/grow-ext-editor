/**
 * Content editor.
 */

import Config from '../../utility/config'
import {
  html,
  render,
  repeat,
} from 'selective-edit'
import Storage from '../../utility/storage'


export default class MenuBase {
  constructor(config) {
    this.config = new Config(config || {})
    this.storage = new Storage(this.isTesting)
  }

  get isTesting() {
    return this.config.get('testing', false)
  }

  render() {
    // Trigger a render event.
    document.dispatchEvent(new CustomEvent('selective.render'))
  }
}
