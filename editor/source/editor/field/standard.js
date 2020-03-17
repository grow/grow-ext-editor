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
import pell from 'pell'
import showdown from 'showdown'


export class CheckboxField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'checkbox'
  }

  classesIcon(value) {
    const classes = [
      'material-icons',
      'selective__field__checkbox__icon',
    ]

    if (value) {
      classes.push('selective__field__checkbox__icon--checked')
    }

    return classes.join(' ')
  }

  classesLabel(value) {
    const classes = [
      'selective__field__checkbox__label',
    ]

    if (value) {
      classes.push('selective__field__checkbox__label--checked')
    }

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
          class=${this.classesLabel(value)}
          data-locale=${locale || ''}
          @click=${this.handleInput.bind(this)}>
        ${this.config.label}
      </div>
      <i
          class=${this.classesIcon(value)}
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
    if (value && value.length > 16) {
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
    this.showdown = new showdown.Converter()
  }

  renderInput(selective, data, locale) {
    return html`<div id="${field.getUid()}" class="pell" data-locale=${locale}></div>`
  }

  postRender(containerEl) {
    const actions = this.getConfig().get('pellActions', [
      'bold', 'italic', 'heading1', 'heading2', 'olist', 'ulist', 'link'])
    const fieldInstances = containerEl.querySelectorAll('.selective__field__markdown')
    for (const fieldInstance of fieldInstances) {
      const pellEl = fieldInstance.querySelector('.pell')
      const locale = pellEl.dataset.locale
      const value = this.getValueForLocale(locale) || ''

      if (!fieldInstance.pellEditor) {
        fieldInstance.pellEditor = pell.init({
          element: pellEl,
          actions: actions,
          onChange: (html) => {
            this.value = this.showdown.makeMarkdown(html)
          }
        })
      }

      fieldInstance.pellEditor.content.innerHTML = this.showdown.makeHtml(value || '')
    }
  }
}

export class SelectField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'select'
    this.threshold = this.config.threshold || 12

    // [0]: Unselected
    // [1]: Selected
    this.icons = (this.config.multi
      ? ['check_box_outline_blank', 'check_box']
      : ['radio_button_unchecked', 'radio_button_checked'])
  }

  _cleanOriginalValue(value) {
    // Original values need to be sorted when doing multi.
    if (this.config.multi) {
      value = value || []

      // Convert multi to be an array if it was not before.
      if (!Array.isArray(value)) {
        value = [value]
      }

      value.sort()
      return value
    }

    // Convert from an array if it was before.
    if (Array.isArray(value)) {
      // Use the first value of the existing array.
      value = value[0]
    }

    return value
  }

  handleInput(evt) {
    const target = findParentByClassname(evt.target, 'selective__field__select__option')
    const locale = target.dataset.locale
    let value = target.dataset.value

    if (this.config.multi) {
      let existingValue = this.getValueForLocale(locale) || []
      if (existingValue.includes(value)) {
        existingValue = existingValue.filter(item => item !== value)
      } else {
        existingValue.push(value)
      }
      existingValue.sort()

      // Save the updated value array.
      value = existingValue
    }

    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    const options = this.config.options
    const isOptionSelected = (optionValue) => {
      if (this.config.multi) {
        return value.includes(optionValue)
      }
      return value == optionValue
    }

    return html`
      <div class="selective__field__select__options">
        ${repeat(options, (option) => option.value, (option, index) => html`
          <div
              class="selective__field__select__option ${isOptionSelected(option.value) ? 'selective__field__select__option--checked' : ''}"
              data-locale=${locale || ''}
              data-value=${option.value || ''}
              @click=${this.handleInput.bind(this)}>
            <i class="material-icons">
              ${isOptionSelected(option.value) ? this.icons[1] : this.icons[0] }
            </i>
            <div>
              ${option.label || '(None)'}
            </div>
          </div>
        `)}
      </div>`
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
