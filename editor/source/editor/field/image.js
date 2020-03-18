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
  findParentByClassname,
} from '../../utility/dom'
import {
  createWhiteBlackFilter,
  regexList,
} from '../../utility/filter'
import {
  FileListUI,
} from '../ui/file'



const VALID_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif']
const IMAGE_HOVER_CLASS = 'selective__image--hover'


const fractReduce = (numerator,denominator) => {
  // Reduce a fraction by finding the Greatest Common Divisor and dividing by it.
  const gcd = (a, b) => {
    return b ? gcd(b, a % b) : a
  }
  const fracGcd = gcd(numerator, denominator)
  return [numerator/fracGcd, denominator/fracGcd]
}


export class ImageField extends FieldRewrite {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'image'
    this._aspects = {}
    this._showFileInput = {}
    this._isLoading = {}
  }

  _targetForDrop(evt) {
    const target = findParentByClassname(
      evt.target, `selective__field__image_file__wrapper`)

    if (!target) {
      return false
    }

    if (evt.dataTransfer.types.includes('Files')) {
      evt.preventDefault()
      evt.stopPropagation()
      return target
    }
  }

  delayedFocus(locale) {
    // Wait for the render then focus on the file input.
    // TODO: Add a listenOnce feature to the listeners with a
    // post render event to trigger focus.
    window.setTimeout(
      () => {
        document.getElementById(`${this.uid}${locale || ''}-file`).click()
      },
      25)
  }

  getServingPath(value, locale) {
    return value
  }

  handleDragDrop(evt) {
    const target = this._targetForDrop(evt)
    target.classList.remove(IMAGE_HOVER_CLASS)

    const files = evt.dataTransfer.files
    const validFiles = []
    for (const file of files) {
      if (VALID_MIME_TYPES.includes(file.type)) {
        validFiles.push(file)
      }
    }

    if (validFiles.length < 1) {
      return
    }

    const locale = target.dataset.locale

    // There can be only one.
    this.uploadFile(validFiles[0], locale)
  }

  handleDragEnter(evt) {
    const target = this._targetForDrop(evt)
    target.classList.add(IMAGE_HOVER_CLASS)
  }

  handleDragLeave(evt) {
    const target = this._targetForDrop(evt)

    // Only remove the hover class when the event comes from the actual target.
    // Otherwise it is crazy to get the class due to bubbling.
    if (evt.target === target) {
      target.classList.remove(IMAGE_HOVER_CLASS)
    }
  }

  handleDragOver(evt) {
    this._targetForDrop(evt)
  }

  handleFileInput(evt) {
    if (!this.api) {
      console.error('Missing api for image field.')
      return
    }

    const locale = evt.target.dataset.locale
    const localeKey = this.keyForLocale(locale)

    this.uploadFile(evt.target.files[0], locale)
    this._isLoading[localeKey] = true
    this.render()
  }

  handleFileInputToggleClick(evt) {
    const locale = evt.target.dataset.locale
    const localeKey = this.keyForLocale(locale)
    this._showFileInput[localeKey] = !(this._showFileInput[localeKey] || false)
    this.render()

    if (this._showFileInput[localeKey]) {
      this.delayedFocus(locale)
    }
  }

  handleImageLoad(evt) {
    this._aspects[evt.target.dataset.servingPath] = {
      height: evt.target.naturalHeight,
      width: evt.target.naturalWidth,
    }
    this.render()
  }

  renderFileInput(selective, data, locale) {
    const localeKey = this.keyForLocale(locale)

    if (!this._showFileInput[localeKey]) {
      return ''
    }

    return html`
      <input
        type="file"
        id="${this.uid}${locale || ''}-file"
        data-locale=${locale || ''}
        ?disabled=${this._isLoading[localeKey]}
        @input=${this.handleFileInput.bind(this)} />`
  }

  renderImageMeta(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    const servingPath = this.getServingPath(value, locale)
    const aspect = this._aspects[servingPath]

    if (!aspect) {
      return ''
    }

    const ratio = fractReduce(aspect.width, aspect.height)

    return html`
      <div class="selective__image__preview__meta__size">
        <span class="selective__image__preview__meta__label">Size:</span>
        <span class="selective__image__preview__meta__value">${aspect.width}x${aspect.height}</span>
      </div>
      <div class="selective__image__preview__meta__ratio">
        <span class="selective__image__preview__meta__label">Ratio:</span>
        <span class="selective__image__preview__meta__value">${ratio[0]}:${ratio[1]}</span>
      </div>`
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    const localeKey = this.keyForLocale(locale)

    return html`
      <div
          class="selective__field__image_file__wrapper"
          @drop=${this.handleDragDrop.bind(this)}
          @dragenter=${this.handleDragEnter.bind(this)}
          @dragleave=${this.handleDragLeave.bind(this)}
          @dragover=${this.handleDragOver.bind(this)}
          data-locale=${locale || ''}>
        <div class="selective__field__image_file__input">
          <input
            id="${this.uid}${locale}"
            placeholder=${this.config.placeholder || ''}
            data-locale=${locale || ''}
            ?disabled=${this._isLoading[localeKey]}
            @input=${this.handleInput.bind(this)}
            value=${value || ''} />
          <i
              class="material-icons selective__field__image_file__file_input_icon"
              title="Upload file"
              data-locale=${locale || ''}
              @click=${this.handleFileInputToggleClick.bind(this)}>
            attachment
          </i>
        </div>
        ${this.renderFileInput(selective, data, locale)}
        ${this.renderPreview(selective, data, locale)}
      </div>`
  }

  renderPreview(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    const localeKey = this.keyForLocale(locale)
    const servingPath = this.getServingPath(value, locale)

    if (this._isLoading[localeKey]) {
      return html`
        <div id="${this.uid}${locale}-preview" class="selective__image__preview">
          <div class="editor__loading editor__loading--small editor__loading--pad"></div>
        </div>`
    }

    if (!servingPath || servingPath == '') {
      return ''
    }

    return html`
      <div id="${this.uid}${locale}-preview" class="selective__image__preview">
        <div class="selective__image__preview__image">
          <img
            data-serving-path=${servingPath}
            @load=${this.handleImageLoad.bind(this)}
            src="${servingPath}" />
        </div>
        <div class="selective__image__preview__meta">
          ${this.renderImageMeta(selective, data, locale)}
        </div>
      </div>`
  }

  uploadFile(file, locale) {
    const destination = this.getConfig().get('destination', '/static/img/upload')
    const localeKey = this.keyForLocale(locale)

    this.api.saveImage(file, destination).then((result) => {
      this._showFileInput[localeKey] = false
      this._isLoading[localeKey] = false
      this.setValueForLocale(locale, result['pod_path'])
    }).catch((err) => {
      console.error(err)
      this.render()
    })
  }
}

export class ImageFileField extends ImageField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'image_file'
    this._fileListUi = {}
    this.filterFunc = createWhiteBlackFilter(
      regexList(this.config.get('whitelist'), [/^\/static\/.*\.(jp[e]?g|png|svg|webp)$/]),  // Whitelist.
      regexList(this.config.get('blacklist')),  // Blacklist.
    )

    // Use the API to get serving paths for local images.
    this.api = this.getConfig().get('api')
    this._servingPaths = {}
    this._servingPathsLoading = {}
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

  getServingPath(value, locale) {
    return this.loadPreview(value, locale)
  }

  handleFilesToggleClick(evt) {
    const locale = evt.target.dataset.locale
    this.fileListUiForLocale(locale).toggle()
  }

  handlePodPath(podPath, locale) {
    const value = podPath
    this.setValueForLocale(locale, value)
  }

  handleServingPathResponse(response) {
    this._servingPaths[response.pod_path] = response.serving_url
    this.render()
  }

  loadPreview(value, locale) {
    if (!value || value == '') {
      return
    }

    if (this._servingPaths[value]) {
      return this._servingPaths[value]
    }

    if (this._servingPathsLoading[value]) {
      return ''
    }

    // Mark that the request has started to prevent duplicate requests.
    this._servingPathsLoading[value] = true

    // Have not loaded the serving url yet. Load it in.
    this.api.getStaticServingPath(
      value).then(this.handleServingPathResponse.bind(this))
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || ''
    const fileListUi = this.fileListUiForLocale(locale)

    return html`
      <div
          class="selective__field__image_file__wrapper"
          @drop=${this.handleDragDrop.bind(this)}
          @dragenter=${this.handleDragEnter.bind(this)}
          @dragleave=${this.handleDragLeave.bind(this)}
          @dragover=${this.handleDragOver.bind(this)}
          data-locale=${locale || ''}>
        <div class="selective__field__image_file__input">
          <input
            id="${this.uid}${locale}"
            placeholder=${this.config.placeholder || ''}
            data-locale=${locale || ''}
            @input=${this.handleInput.bind(this)}
            value=${value || ''} />
          <i
              class="material-icons selective__field__image_file__file_input_icon"
              title="Upload file"
              data-locale=${locale || ''}
              @click=${this.handleFileInputToggleClick.bind(this)}>
            attachment
          </i>
          <i
              class="material-icons selective__field__image_file__file_icon"
              title="Select pod path"
              data-locale=${locale || ''}
              @click=${this.handleFilesToggleClick.bind(this)}>
            list_alt
          </i>
        </div>
        ${fileListUi.renderFileList(selective, data, locale)}
        ${this.renderFileInput(selective, data, locale)}
        ${this.renderPreview(selective, data, locale)}
      </div>`
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
