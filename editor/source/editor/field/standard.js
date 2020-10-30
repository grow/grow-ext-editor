/**
 * Standard field types for the editor extension.
 */

import {
  Field,
  html,
  repeat,
  unsafeHTML,
} from 'selective-edit'
import Quill from 'quill/quill'
import Editor from '@toast-ui/editor'
import ExternalLink from '../tui-editor/externalLink'
import {
  findParentByClassname,
  inputFocusAtPosition,
} from '../../utility/dom'
import ImageUploader from '../quill/image-upload'

export class CheckboxField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'checkbox'
  }

  classesInput(value) {
    const classes = [
      'selective__field__input__option'
    ]

    if (value) {
      classes.push('selective__field__input__option--selected')
    }

    return classes.join(' ')
  }

  handleInput(evt) {
    const target = findParentByClassname(evt.target, 'selective__field__input__option')
    const locale = target.dataset.locale
    const value = !(this.getValueForLocale(locale) || false)
    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || false

    return html`
      <div
          class=${this.classesInput(value)}
          data-locale=${locale || ''}
          @click=${this.handleInput.bind(this)}>
        <div class="selective__field__label">
          ${this.config.label}
        </div>
        <i class="material-icons">
          ${value ? 'check_box' : 'check_box_outline_blank'}
        </i>
      </div>`
  }

  // Label is shown by the individual input.
  renderLabel(selective, data) {
    return ''
  }
}

export class DateField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'date'
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    return html`
      <input
        id="${this.uid}${locale || ''}"
        type="date"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value} />`
  }
}

export class DateTimeField extends Field {
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
        id="${this.uid}${locale || ''}"
        type="datetime-local"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value} />`
  }
}

export class HtmlField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'html'
    this.api = this.config.get('api')

    if (!this.api) {
      console.error('Missing api for image upload.')
    }

    this.imageUploader = null

    // TODO: Change to use the google image after the extension is updated to the new
    // Extension style.
    // this._extension_config_promise = this.api.getExtensionConfig(
    //   'extensions.google_cloud_images.GoogleCloudImageExtension')
    this._extension_config_promise = this.api.getExtensionConfig('extensions.editor.EditorExtension')
    this._extension_config_promise.then((extension_config) => {
      if (extension_config['googleImageUploadUrl']) {
        const uploadUrl = extension_config['googleImageUploadUrl']
        const bucket = extension_config['googleImageBucket']

        this.imageUploader = new ImageUploader(async (imageBlob) => {
          const result = await this.api.saveGoogleImage(
            imageBlob, uploadUrl, bucket)
          return result['url']
        })
      } else {
        const destination = this.config.get('destination', '/static/img/upload')

        this.imageUploader = new ImageUploader(async (imageBlob) => {
          const result = await this.api.saveImage(imageBlob, destination)
          return result['serving_url']
        })
      }
    })
  }

  // Original values may extra blank space.
  _cleanOriginalValue(value) {
    if (value) {
      value = value.trim()
    }
    return value
  }

  imageUpload(element) {
    const base64Str = element.getAttribute('src')
    return this.imageUploader.uploadBase64(base64Str)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    return html`
      <div
          id="${this.uid}${locale || ''}"
          class="selective__html html_editor"
          data-locale=${locale || ''}>${unsafeHTML(value)}</div>`
  }

  postRender(containerEl) {
    const fieldInstances = containerEl.querySelectorAll('.selective__field__type__html')
    for (const fieldInstance of fieldInstances) {
      const editorEls = fieldInstance.querySelectorAll('.html_editor')
      for (const editorEl of editorEls) {
        const locale = editorEl.dataset.locale

        // Skip if the editor element does not match the current field instance.
        if (editorEl.id != `${this.uid}${locale || ''}`) {
          continue
        }

        const value = this.getValueForLocale(locale) || ''

        if (!editorEl.editor) {
          editorEl.editor = new Quill(editorEl, {
            modules: {
              toolbar: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'indent': '-1'}, { 'indent': '+1' }],
                ['link', 'image', 'video'],
                ['clean'],
              ]
            },
            theme: 'snow',
          })

          editorEl.editor.on('text-change', () => {
            const pendingImgs = Array.from(
              editorEl.editor.root.querySelectorAll(
                'img[src^="data:"]:not(.selective__image__uploading)')
            )

            for (const pendingImg of pendingImgs) {
              pendingImg.classList.add("selective__image__uploading")
              // Make sure that the extension has loaded before uploading
              // to make sure it is uploading to the correct place.
              this._extension_config_promise.then(() => {
                this.imageUpload(pendingImg).then((url) => {
                  pendingImg.setAttribute("src", url)
                  pendingImg.classList.remove("selective__image__uploading")
                })
              })
            }

            this.setValueForLocale(locale, editorEl.editor.root.innerHTML)
          })
        }
      }
    }
  }
}

export class MarkdownField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'markdown'
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    return html`
      <div
          id="${this.uid}${locale || ''}"
          class="selective__markdown markdown_editor"
          data-locale=${locale || ''}></div>`
  }

  postRender(containerEl) {
    const fieldInstances = containerEl.querySelectorAll('.selective__field__type__markdown')
    for (const fieldInstance of fieldInstances) {
      const editorEls = fieldInstance.querySelectorAll('.markdown_editor')
      for (const editorEl of editorEls) {
        const locale = editorEl.dataset.locale

        // Skip if the editor element does not match the current field instance.
        if (editorEl.id != `${this.uid}${locale || ''}`) {
          continue
        }

        const value = this.getValueForLocale(locale) || ''

        if (!editorEl.editor) {
          editorEl.editor = new Editor({
            el: editorEl,
            initialValue: value,
            initialEditType: 'markdown',
            previewStyle: 'horizontal',
            usageStatistics: false,
            events: {
              change: () => {
                this.setValueForLocale(locale, editorEl.editor.getMarkdown().trim())
              }
            },
            hideModeSwitch: true,
            placeholder: this.config.placeholder || '',
          })
        } else if (this.isClean) {
           // editorEl.editor.setMarkdown(value || '')
        }
      }
    }
  }
}

export class SelectField extends Field {
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

export class TextField extends Field {
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
      document.addEventListener('selective.render.complete', () => {
        inputFocusAtPosition(id, position)
      }, {
        once: true,
      })
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
          id="${this.uid}${locale || ''}"
          rows=${this.config.rows || 6}
          placeholder=${this.config.placeholder || ''}
          data-locale=${locale || ''}
          @input=${this.handleInput.bind(this)}>${value}</textarea>`
    }

    return html`
      <input
        id="${this.uid}${locale || ''}"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value} />`
  }
}

export class TextareaField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'textarea'
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    return html`
      <textarea
        id="${this.uid}${locale || ''}"
        rows=${this.config.rows || 6}
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}>${value}</textarea>`
  }
}
