/**
 *  Template for options.
 */

import {
  html,
} from 'selective-edit'
import DataType from '../../utility/dataType'
import Color from '../../utility/color'


const BACKGROUND_COLOR = new Color(255, 255, 255)
const CONTRAST_THRESHOLD = 3


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
    const isSmooth = option.smooth == true

    if (DataType.isArray(option.color)) {
      const colorBreakpoints = []
      const numBreakpoints = isSmooth ? option.color.length - 1 : option.color.length
      let breakpoint = Math.floor(100/numBreakpoints)
      colorBreakpoints.push(`${option.color[0]} 0%`)

      let lastColor = null
      for (const color of option.color) {
        if (!lastColor) {
          lastColor = color
          continue
        }

        if (!isSmooth) {
          colorBreakpoints.push(`${lastColor} ${breakpoint}%`)
        }
        colorBreakpoints.push(`${color} ${breakpoint}%`)
        breakpoint += breakpoint
        lastColor = color
      }

      const orientation = option.orientation || 'vertical'
      let orientationAngle = '90deg'

      if (orientation == 'horizontal') {
        orientationAngle = '0deg'
      } else if (orientation == 'angled' || orientation == 'sloped') {
        orientationAngle = '45deg'
      }

      if (!isSmooth) {
        colorBreakpoints.push(`${option.color[option.color.length - 1]} 100%`)
      }

      colorDotStyle = `background: linear-gradient(${orientationAngle}, ${colorBreakpoints.join(', ')});`
      // colorDotSelectedStyle = `box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 3px ${option.color[0]};`
      colorAria = option.color.join(', ')
      classes.push('selective__field__select__option--multiple')
    } else {
      const color = new Color(option.color)
      if (color.contrast(BACKGROUND_COLOR) < CONTRAST_THRESHOLD) {
        classes.push('selective__field__select__option--low_contrast')
      } else {
        colorDotSelectedStyle = `box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px ${option.color};`
      }

      colorDotStyle = `background-color: ${option.color};`
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
