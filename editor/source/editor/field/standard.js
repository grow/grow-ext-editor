/**
 * Standard field types for the editor extension.
 */

import {
  html,
  repeat,
  Field,
  FieldRewrite,
} from 'selective-edit'
import {
  findParentByClassname,
  inputFocusAtPosition,
} from '../../utility/dom'

export class CheckboxField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'checkbox'
  }

  get classesLabel() {
    const classes = [
      'selective__field__checkbox__label',
    ]

    return classes.join(' ')
  }

  handleInput(evt) {
    const locale = evt.target.dataset.locale
    const value = !(this.getValueForLocale(locale) || false)
    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || false

    return html`
      <div
          class=${this.classesLabel}
          data-locale=${locale || ''}
          @click=${this.handleInput.bind(this)}>
        ${this.config.label}
      </div>
      <i
          class="material-icons"
          data-locale=${locale || ''}
          @click=${this.handleInput.bind(this)}>
        ${value ? 'check_box' : 'check_box_outline_blank'}
      </i>`
  }

  // Label is shown by the individual input.
  renderLabel(selective, data) {
    return ''
  }
}

export class DateField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'date'
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    return html`
      <input
        id="${this.uid}${locale}"
        type="date"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value} />`
  }
}

export class DateTimeField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'datetime'
  }

  // Original values may contain seconds which the datetime ignores.
  _cleanOriginalValue(value) {
    if (value.length > 16) {
      value = value.slice(0, 16)
    }
    return value
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    return html`
      <input
        id="${this.uid}${locale}"
        type="datetime-local"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value} />`
  }
}

// TODO: Add a WYSIWYG editor.
// TODO: Ability to switch between markdown and WYSIWYG.
export class MarkdownField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'markdown'
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    return html`
      <textarea
        id="${this.uid}${locale}"
        rows=${this.config.rows || 6}
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}>${value}</textarea>`
  }
}

export class SelectField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'select'
    this.threshold = 12

    // Determine which icons to use
    this.useMulti = this.getConfig().get('multi', false)
    this.icons = (this.useMulti
      ? ['check_box_outline_blank', 'check_box']
      : ['radio_button_unchecked', 'radio_button_checked'])

    this.template = (selective, field, data) => html`<div
        class="selective__field selective__field__${field.fieldType} ${field.options.length > field.threshold ? `selective__field__${field.fieldType}--list` : ''}"
        data-field-type="${field.fieldType}" >
      <div class="selective__field__select__label">${field.label}</div>
      <div class="selective__field__select__options">
        ${repeat(field.options, (option) => option.value, (option, index) => html`
          <div class="selective__field__select__value" data-value="${option.value}" @click=${field.handleInput.bind(field)}>
            <div class="selective__field__select__option ${field._isSelected(option.value) ? 'selective__field__select__option--checked' : ''}">
              <i class="material-icons">${field._isSelected(option.value) ? field.icons[1] : field.icons[0] }</i>
              ${option.label || '(None)'}
            </div>
          </div>
        `)}
      </div>
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  _isSelected(optionValue) {
    let value = this.value

    if (!this.useMulti) {
      return value == '' ? optionValue == null : optionValue == value
    }

    // Reset when converting between non-array values.
    if (!Array.isArray(value)) {
      value = []
    }

    return (value || []).includes(optionValue)
  }

  handleInput(evt) {
    const target = findParentByClassname(evt.target, 'selective__field__select__value')
    const value = target.dataset.value == 'null' ? null : target.dataset.value

    if (!this.useMulti) {
      this.value = value
      document.dispatchEvent(new CustomEvent('selective.render'))
      return
    }

    if (!value) {
      return
    }

    // Adjust the list if using multi value
    let newValue = this.value || []

    // Reset when converting between non-array values.
    if (!Array.isArray(newValue)) {
      newValue = []
    }

    if (newValue.includes(value)) {
      newValue = newValue.filter(item => item !== value)
    } else {
      newValue.push(value)
    }
    this.value = newValue
    document.dispatchEvent(new CustomEvent('selective.render'))
  }
}

export class TextField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'text'

    // When the text field is too long, convert input to a textarea.
    this.threshold = this.config.threshold || 75
    this._switched = {}
  }

  handleInput(evt) {
    // Check if the threshold has been reached.
    const target = evt.target
    const locale = target.dataset.locale
    const isInput = target.tagName.toLowerCase() == 'input'
    const isOverThreshold = target.value.length > this.threshold
    const hasSwitched = this._switched[locale]
    if (isInput && isOverThreshold && !hasSwitched) {
      const id = target.id
      const position = target.selectionStart

      // Trigger auto focus after a delay for rendering.
      window.setTimeout(() => { inputFocusAtPosition(id, position) }, 25)
    }

    // Handle input after the check is complete for length.
    // Prevents the re-render before the check is done.
    super.handleInput(evt)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    if (value.length > this.threshold) {
      this._switched[locale] = true
    }

    if (this._switched[locale]) {
      return html`
        <textarea
          id="${this.uid}${locale}"
          rows=${this.config.rows || 6}
          placeholder=${this.config.placeholder || ''}
          data-locale=${locale || ''}
          @input=${this.handleInput.bind(this)}>${value}</textarea>`
    }

    return html`
      <input
        id="${this.uid}${locale}"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value} />`
  }
}

export class TextareaField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'textarea'
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    return html`
      <textarea
        id="${this.uid}${locale}"
        rows=${this.config.rows || 6}
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}>${value}</textarea>`
  }
}
