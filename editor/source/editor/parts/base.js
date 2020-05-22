/**
 * Base class for UI parts.
 */

export default class BasePart {
  constructor() {}

  render() {
    // Trigger a render event.
    document.dispatchEvent(new CustomEvent('selective.render'))
  }
}
