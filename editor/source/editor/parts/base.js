/**
 * Base class for UI parts.
 */

export default class BasePart {
  render() {
    // Trigger a render event.
    document.dispatchEvent(new CustomEvent('selective.render'))
  }
}
