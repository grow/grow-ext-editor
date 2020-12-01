/**
 *  Template for options.
 */

import {
  html,
} from 'selective-edit'
import DataType from '../../utility/dataType'


const templateOptionColor = (locale, option, isSelected, classes, handlers) => {
  isSelected = isSelected || false
  classes = classes || []

  if (isSelected) {
    classes.push('selective__field__select__option--checked')
  }

  let colorDotStyle = ''
  let colorDotSelectedStyle = ''
  let colorAria = ''
  if (option.color) {
    classes.push('selective__field__select__option--colored')

    if (DataType.isArray(option.color)) {
      const colorBreakpoints = []
      let breakpoint = Math.floor(100/option.color.length)
      colorBreakpoints.push(`${option.color[0]} 0%`)

      let lastColor = null
      for (const color of option.color) {
        if (!lastColor) {
          lastColor = color
          continue
        }

        colorBreakpoints.push(`${lastColor} ${breakpoint}%`)
        colorBreakpoints.push(`${color} ${breakpoint}%`)
        breakpoint += breakpoint
        lastColor = color
      }

      colorBreakpoints.push(`${option.color[option.color.length - 1]} 100%`)

      colorDotStyle = `background: linear-gradient(45deg, ${colorBreakpoints.join(', ')});`
      // colorDotSelectedStyle = `box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 3px ${option.color[0]};`
      colorAria = option.color.join(', ')
    } else {
      colorDotStyle = `background-color: ${option.color};`
      colorDotSelectedStyle = `box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 3px ${option.color};`
      colorAria = option.color
    }
  }

  return html`
    <div
        class="selective__field__select__option ${classes.join(' ')}"
        data-locale=${locale || ''}
        data-value=${option.value || ''}
        @click=${handlers.handleInput}>
      <div
          class="selective__field__select__dot"
          aria-label=${colorAria}
          style="${colorDotStyle} ${isSelected ? colorDotSelectedStyle : ''}"></div>
      <div>
        ${option.label || '(Empty)'}
      </div>
    </div>`
}

export { templateOptionColor }
