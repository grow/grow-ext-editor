/**
 * Image field types for the editor extension.
 */

import {
  directive,
  html,
  repeat,
  Field,
  FieldRewrite,
} from 'selective-edit'
import {
  createWhiteBlackFilter,
  regexList,
} from '../../utility/filter'
import {
  FileListUI,
} from '../ui/file'


export class ImageField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'image'
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''

    return html`
      <input
        id="${this.uid}${locale}"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value} />`
  }
}

export class ImageFileField extends ImageField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'image_file'
    this._fileListUi = {}
    this._showFileList = {}
    this.filterFunc = createWhiteBlackFilter(
      regexList(this.config.get('whitelist'), [/^\/static\/.*\.(jp[e]?g|png|svg|webp)$/]),  // Whitelist.
      regexList(this.config.get('blacklist')),  // Blacklist.
    )
  }

  fileListUiForLocale(locale) {
    const localeKey = this.keyForLocale(locale)
    if (!this._fileListUi[localeKey]) {
      this._fileListUi[localeKey] = new FileListUI({
        'filterFunc': this.filterFunc,
      })

      // Bind the pod path listener event for the UI.
      this._fileListUi[localeKey].listeners.add('podPath', this.handlePodPath.bind(this))
    }
    return this._fileListUi[localeKey]
  }

  handleFilesToggleClick(evt) {
    const locale = evt.target.dataset.locale
    this.fileListUiForLocale(locale).toggle()
  }

  handlePodPath(podPath, locale) {
    const value = podPath
    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    const fileListUi = this.fileListUiForLocale(locale)

    return html`
      <div class="selective__field__image_file__input">
        <input
          id="${this.uid}${locale}"
          placeholder=${this.config.placeholder || ''}
          data-locale=${locale || ''}
          @input=${this.handleInput.bind(this)}
          value=${value || ''} />
        <i
            class="material-icons selective__field__image_file__file_icon"
            title="Select pod path"
            data-locale=${locale || ''}
            @click=${this.handleFilesToggleClick.bind(this)}>
          list_alt
        </i>
      </div>
      ${fileListUi.renderFileList(selective, data, locale)}`
  }
}


export class LegacyImageField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'image'
    this.previewUrl = ''
    this.isLoading = false

    // Set the api if it was provided
    this.api = this.getConfig().get('api')

    this.template = (selective, field, data) => html`<div class="selective__field selective__field__${field.fieldType}" data-field-type="${field.fieldType}">
      <label for="${field.getUid()}">${field.label}</label>
      <input
        id="${field.getUid()}"
        type="text"
        placeholder="${field.placeholder}"
        value="${field.valueFromData(data) || ''}"
        @input=${field.handleInput.bind(field)}
        ?disabled="${field.isLoading}">
      <input
        type="file"
        id="${field.getUid()}_file"
        placeholder="Upload new image"
        @change=${field.handleFileInput.bind(field)}
        ?disabled="${field.isLoading}">
      ${field.renderImagePreview(selective, field, data)}
      ${field.renderHelp(selective, field, data)}
    </div>`
  }

  renderImagePreview(selective, field, data) {
    if (field.previewUrl == '') {
      return ''
    }

    if (field.isLoading) {
      return html`<div class="selective__field__${field.fieldType}__preview"><div class="editor__loading editor__loading--small" title="Loading..."></div></div>`
    }

    // Depends on image element, so needs to run after image has loaded.
    const imageSizeDirective = directive((field) => (part) => {
      setTimeout(() => {
        let el = document.getElementById(`${field.getUid()}_preview`)
        let imageEl = el.querySelector('img')
        const updateImage = (() => {
          part.setValue(`Aspect ratio: ${imageEl.naturalWidth}x${imageEl.naturalHeight}`);
          part.commit();
        })
        // If the image has already loaded.
        imageEl.complete ? updateImage() : imageEl.addEventListener('load', updateImage)
      });
    })

    return html`
      <div class="selective__field__${field.fieldType}__preview" id="${field.getUid()}_preview">
        <div class="selective__field__${field.fieldType}__preview__image"><a href="${field.previewUrl}"><img src="${field.previewUrl}"></a></div>
        <div class="selective__field__${field.fieldType}__preview__meta">${imageSizeDirective(field)}</div>
      </div>`
  }

  handleFileInput(evt) {
    if (!this.api) {
      console.error('Missing api for image field.')
      return
    }

    const destination = this.getConfig().get('destination', '/static/img/upload')
    this.api.saveImage(evt.target.files[0], destination).then((result) => {
      this.isLoading = false
      this.value = result
      this.previewUrl = result
      document.dispatchEvent(new CustomEvent('selective.render'))
    }).catch((err) => {
      this.isLoading = false
      document.dispatchEvent(new CustomEvent('selective.render'))
    })

    this.isLoading = true
    document.dispatchEvent(new CustomEvent('selective.render'))
  }
}

// TODO: Move into the google image extension.
export class GoogleImageField extends LegacyImageField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'google_image'

    // TODO: Change to use the API after the extension is updated to the new
    // Extension style.
    // this._extension_config_promise = this.api.getExtensionConfig(
    //   'extensions.google_cloud_images.GoogleCloudImageExtension')
    this._extension_config_promise = this.api.getExtensionConfig(
      'extensions.editor.EditorExtension')

    // Wait for the config promise to return.
    this._extension_config_promise.then((result) => {
      let previewPrefix = result['googleImagePreviewPrefix']

      // TODO: Remove once grow > 0.8.20
      if (!previewPrefix) {
        console.warn('Hardcoded image preview URL.');
        previewPrefix = 'https://ext-cloud-images-dot-betterplaceforests-website.appspot.com'
      }

      this.previewPrefix = previewPrefix
      document.dispatchEvent(new CustomEvent('selective.render'))
    })
  }

  handleFileInput(evt) {
    if (!this.api) {
      console.error('Missing api for image field.')
      return
    }

    // Wait for the url promise to return.
    this._extension_config_promise.then((result) => {
      let uploadUrl = result['googleImageUploadUrl']

      // TODO: Remove once grow > 0.8.20
      if (!uploadUrl) {
        console.warn('Hardcoded image upload URL.');
        uploadUrl = 'https://ext-cloud-images-dot-betterplaceforests-website.appspot.com/_api/upload_file'
      }

      this.api.saveGoogleImage(evt.target.files[0], uploadUrl).then((result) => {
        this.value = result['url']
        this.previewUrl = result['url']
        this.isLoading = false
        document.dispatchEvent(new CustomEvent('selective.render'))
      }).catch((err) => {
        console.error(err)
        this.isLoading = false
        document.dispatchEvent(new CustomEvent('selective.render'))
      })

      this.isLoading = true
      document.dispatchEvent(new CustomEvent('selective.render'))
    })
  }

  renderImagePreview(selective, field, data) {
    // Ignore the field values that are resource paths.
    if (field.value && field.value.startsWith('http')) {
      field.previewUrl = field.value
    }

    return super.renderImagePreview(selective, field, data)
  }
}
