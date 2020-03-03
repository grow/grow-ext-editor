import Editor from '../editor/editor'
import Throttle from '../utility/throttle'

// Throttled events.
new Throttle('resize', 'opt_resize')
new Throttle('scroll', 'opt_scroll')

export default Editor

window.Editor = Editor
