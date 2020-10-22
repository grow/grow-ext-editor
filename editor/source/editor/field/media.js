/**
 * Media field types for the editor extension.
 */

import * as extend from 'deep-extend'
import {
  directive,
  html,
  repeat,
  Field,
  GroupField,
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


const VALID_IMAGE_MIME_TYPES = [
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
]
const VALID_VIDEO_MIME_TYPES = [
  'image/mp4',
  'image/mov',
  'image/webm',
]
const MIME_TYPE_TO_EXT = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/mp4': 'mp4',
  'image/mov': 'mov',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webm': 'webm',
  'image/webp': 'webp',
}
const EXT_TO_MIME_TYPE = {
  'avif': 'image/avif',
  'gif': 'image/gif',
  'jpeg': 'image/jpg',
  'jpg': 'image/jpg',
  'mp4': 'image/mp4',
  'mov': 'image/mov',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'webm': 'image/webm',
  'webp': 'image/webp',
}
const MEDIA_HOVER_CLASS = 'selective__media--hover'
const FILE_EXT_REGEX = /\.[0-9a-z]{1,5}$/i
const ABSOLUTE_URL_REGEX = /^(\/\/|http(s)?:)/i
const SUB_FIELDS_KEY = 'extra'


const fractReduce = (numerator,denominator) => {
  // Reduce a fraction by finding the Greatest Common Divisor and dividing by it.
  const gcd = (a, b) => {
    return b ? gcd(b, a % b) : a
  }
  const fracGcd = gcd(numerator, denominator)
  return [numerator/fracGcd, denominator/fracGcd]
}


export class MediaField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'media'
    this._metas = {}
    this._subFields = {}
    this._showFileInput = {}
    this._isLoading = {}
    this._originalValue = {}
    this._value = {}
  }

  _targetForDrop(evt) {
    const target = findParentByClassname(
      evt.target, `selective__field__media_file__wrapper`)

    if (!target) {
      return false
    }

    if (evt.dataTransfer.types.includes('Files')) {
      evt.preventDefault()
      evt.stopPropagation()
      return target
    }
  }

  get isClean() {
    if (!super.isClean) {
      return false
    }

    // Check the sub fields to see if they are clean.
    for (const localeKey of Object.keys(this._subFields)) {
      if (!this._subFields[localeKey].isClean) {
        return false
      }
    }

    return true
  }

  get value() {
    let subFieldValue = {}

    const localeKey = this.keyForLocale()
    if (this._subFields[localeKey]) {
      subFieldValue[SUB_FIELDS_KEY] = this._subFields[localeKey].value
    }

    return extend(
      {},
      this._value,
      subFieldValue)
  }

  set value(value) {
    this._value = value
  }

  delayedFocus(locale) {
    // Wait for the render then focus on the file input.
    document.addEventListener('selective.render.complete', () => {
      document.getElementById(`${this.uid}${locale || ''}-file`).click()
    }, {
      once: true,
    })
  }

  getServingPath(value, locale) {
    if (!value || value == '') {
      return
    }

    return value
  }

  getValueForLocale(locale) {
    let subFieldValue = {}

    const localeKey = this.keyForLocale(locale)
    if (this._subFields[localeKey]) {
      subFieldValue[SUB_FIELDS_KEY] = this._subFields[localeKey].value
    }

    return extend(
      {},
      super.getValueForLocale(locale),
      subFieldValue)
  }

  handleDragDrop(evt) {
    const target = this._targetForDrop(evt)
    target.classList.remove(MEDIA_HOVER_CLASS)

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
    target.classList.add(MEDIA_HOVER_CLASS)
  }

  handleDragLeave(evt) {
    const target = this._targetForDrop(evt)

    // Only remove the hover class when the event comes from the actual target.
    // Otherwise it is crazy to get the class due to bubbling.
    if (evt.target === target) {
      target.classList.remove(MEDIA_HOVER_CLASS)
    }
  }

  handleDragOver(evt) {
    this._targetForDrop(evt)
  }

  handleFileInput(evt) {
    if (!this.api) {
      console.error('Missing api for media field.')
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
    if (this._showFileInput[localeKey]) {
      this.delayedFocus(locale)
    }
    this.render()
  }

  handleInput(evt) {
    const url = evt.target.value
    const locale = evt.target.dataset.locale
    const value = this.getValueForLocale(locale) || {}
    this.setValueForLocale(locale, extend({}, value, {
      'url': url,
    }))

    this.render()
  }

  handleLabelInput(evt) {
    const label = evt.target.value
    const locale = evt.target.dataset.locale
    const value = this.getValueForLocale(locale) || {}
    this.setValueForLocale(locale, extend({}, value, {
      'label': label
    }))
    this.render()
  }

  handleMediaLoad(evt) {
    const meta = {
      height: evt.target.naturalHeight,
      width: evt.target.naturalWidth,
    }

    // Copy the meta information into the value.
    const locale = evt.target.dataset.locale
    const value = this.getValueForLocale(locale) || {}
    this.setValueForLocale(locale, extend({}, value, {
      '_meta': meta,
    }))

    this._metas[evt.target.dataset.servingPath] = meta
    this.render()
  }

  handleVideoLoad(evt) {
    const meta = {
      height: evt.target.videoHeight,
      width: evt.target.videoWidth,
    }

    // Copy the meta information into the value.
    const locale = evt.target.dataset.locale
    const value = this.getValueForLocale(locale) || {}
    this.setValueForLocale(locale, extend({}, value, {
      '_meta': meta,
    }))

    this._metas[evt.target.dataset.servingPath] = meta
    this.render()
  }

  renderFileInput(selective, data, locale) {
    const localeKey = this.keyForLocale(locale)

    if (!this._showFileInput[localeKey]) {
      return ''
    }

    return html`
      <div class="selective__media__file">
        <input
          type="file"
          id="${this.uid}${locale || ''}-file"
          data-locale=${locale || ''}
          ?disabled=${this._isLoading[localeKey]}
          @input=${this.handleFileInput.bind(this)} />
      </div>`
  }

  renderLabelInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || {}
    const localeKey = this.keyForLocale(locale)
    const label = value.label || ''

    return html`
      <div class="selective__media__label">
        <div class="selective__field__label selective__field__label--secondary">
          Accessibility Label
        </div>
        <input
          type="text"
          placeholder="Accessibility Label"
          id="${this.uid}${locale || ''}-label"
          data-locale=${locale || ''}
          @input=${this.handleLabelInput.bind(this)}
          value=${label} />
      </div>`
  }

  renderMediaMeta(selective, data, locale) {
    const mediaMeta = []
    const value = this.getValueForLocale(locale) || {}
    const url = value.url || ''
    const servingPath = this.getServingPath(url, locale)
    const meta = this._metas[servingPath]

    if (!meta) {
      return ''
    }

    mediaMeta.push(html`
      <div class="selective__media__preview__meta__size">
        <span class="selective__media__preview__meta__label">Size:</span>
        <span class="selective__media__preview__meta__value">${meta.width}x${meta.height}</span>
      </div>`)

    const ratio = fractReduce(meta.width, meta.height)

    mediaMeta.push(html`
      <div class="selective__media__preview__meta__ratio">
        <span class="selective__media__preview__meta__label">Ratio:</span>
        <span class="selective__media__preview__meta__value">${ratio[0]}:${ratio[1]}</span>
      </div>`)

    return mediaMeta
  }

  renderInput(selective, data, locale) {
    const localeKey = this.keyForLocale(locale)
    const value = this.getValueForLocale(locale) || {}
    const url = value.url || ''

    return html`
      <div
          class="selective__field__media_file__wrapper"
          @drop=${this.handleDragDrop.bind(this)}
          @dragenter=${this.handleDragEnter.bind(this)}
          @dragleave=${this.handleDragLeave.bind(this)}
          @dragover=${this.handleDragOver.bind(this)}
          data-locale=${locale || ''}>
        <div class="selective__field__label selective__field__label--secondary">
          Media url
        </div>
        <div class="selective__field__media_file__input">
          <input
            id="${this.uid}${locale || ''}"
            placeholder=${this.config.placeholder || ''}
            data-locale=${locale || ''}
            ?disabled=${this._isLoading[localeKey]}
            @input=${this.handleInput.bind(this)}
            value=${url} />
          <i
              class="material-icons selective__field__media_file__file_input_icon"
              title="Upload file"
              data-locale=${locale || ''}
              @click=${this.handleFileInputToggleClick.bind(this)}>
            publish
          </i>
        </div>
        ${this.renderFileInput(selective, data, locale)}
        ${this.renderPreview(selective, data, locale)}
        ${this.renderLabelInput(selective, data, locale)}
        ${this.renderSubFields(selective, data, locale)}
      </div>`
  }

  renderPreview(selective, data, locale) {
    const value = this.getValueForLocale(locale) || {}
    const url = value.url || ''
    const localeKey = this.keyForLocale(locale)
    const servingPath = this.getServingPath(url, locale)

    if (this._isLoading[localeKey]) {
      return html`
        <div id="${this.uid}${locale || ''}-preview" class="selective__media__preview">
          <div class="editor__loading editor__loading--small editor__loading--pad"></div>
        </div>`
    }

    if (!servingPath || servingPath == '') {
      return ''
    }

    return html`
      <div id="${this.uid}${locale || ''}-preview" class="selective__media__preview">
        <div class="selective__media__preview__media">
          ${this.renderPreviewMedia(selective, data, locale, servingPath)}
        </div>
        <div class="selective__media__preview__meta">
          ${this.renderMediaMeta(selective, data, locale)}
        </div>
      </div>`
  }

  renderPreviewMedia(selective, data, locale, servingPath) {
    for (const fileExt of Object.keys(EXT_TO_MIME_TYPE)) {
      const isVideoFile = VALID_VIDEO_MIME_TYPES.includes(fileExt)
      if (isVideoFile && servingPath.endsWith(`.${fileExt}`)) {
        return html`<video
            data-locale=${locale || ''}
            data-serving-path=${servingPath}
            @loadeddata=${this.handleVideoLoad.bind(this)}
            playsinline disableremoteplayback muted autoplay loop>
          <source src="${servingPath}" />
        </video>`
      }
    }

    return html`<img
      data-locale=${locale || ''}
      data-serving-path=${servingPath}
      @load=${this.handleMediaLoad.bind(this)}
      src="${servingPath}" />`
  }

  renderSubFields(selective, data, locale) {
    if (!this.config.fields) {
      return ''
    }

    const localeKey = this.keyForLocale(locale)

    if (!this._subFields[localeKey]) {
      // Create the subfield's group using the fields config.
      this._subFields[localeKey] = new GroupField({
        'key': SUB_FIELDS_KEY,  // Key name does not matter but required.
        'label': this.config.extraLabel || 'Extra',
        'fields': this.config.fields,
      })
    }

    return this._subFields[localeKey].template(
      selective, this.originalValue, locale)
  }

  uploadFile(file, locale) {
    const destination = this.config.get('destination', '/static/img/upload')
    const localeKey = this.keyForLocale(locale)

    this.api.saveImage(file, destination).then((result) => {
      this._showFileInput[localeKey] = false
      this._isLoading[localeKey] = false
      const value = this.getValueForLocale(locale) || {}
      this.setValueForLocale(locale, extend({}, value, {
        'url': result['pod_path']
      }))
    }).catch((err) => {
      console.error(err)
      this._errors['upload'] = err
      this.render()
    })
  }
}

export class MediaFileField extends MediaField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'media_file'
    this._fileListUi = {}
    this.filterFunc = createWhiteBlackFilter(
      regexList(this.config.get('whitelist'), [/^\/static\/.*\.(jp[e]?g|png|svg|webp)$/]),  // Whitelist.
      regexList(this.config.get('blacklist')),  // Blacklist.
    )

    // Use the API to get serving paths for local medias.
    this.api = this.config.get('api')
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
    if (!value || value == '') {
      return
    }

    if (ABSOLUTE_URL_REGEX.test(value)) {
      return value
    }

    if (this._servingPaths[value]) {
      return this._servingPaths[value]
    }

    if (this._servingPathsLoading[value]) {
      return
    }

    // Mark that the request has started to prevent duplicate requests.
    this._servingPathsLoading[value] = true

    // Have not loaded the serving url yet. Load it in.
    this.api.getStaticServingPath(
      value).then(this.handleServingPathResponse.bind(this))
  }

  handleFilesToggleClick(evt) {
    const locale = evt.target.dataset.locale
    this.fileListUiForLocale(locale).toggle()
  }

  handlePodPath(podPath, locale) {
    const value = this.getValueForLocale(locale) || {}
    this.setValueForLocale(locale, extend({}, value, {
      url: podPath
    }))
  }

  handleServingPathResponse(response) {
    this._servingPaths[response.pod_path] = response.serving_url
    this.render()
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || {}
    const url = value.url || ''
    const fileListUi = this.fileListUiForLocale(locale)

    return html`
      <div
          class="selective__field__media_file__wrapper"
          @drop=${this.handleDragDrop.bind(this)}
          @dragenter=${this.handleDragEnter.bind(this)}
          @dragleave=${this.handleDragLeave.bind(this)}
          @dragover=${this.handleDragOver.bind(this)}
          data-locale=${locale || ''}>
        ${this.renderInputLabel(selective, data, locale)}
        <div class="selective__field__media_file__input">
          <input
            id="${this.uid}${locale || ''}"
            placeholder=${this.config.placeholder || ''}
            data-locale=${locale || ''}
            @input=${this.handleInput.bind(this)}
            value=${url || ''} />
          <i
              class="material-icons selective__field__media_file__file_input_icon"
              title="Upload file"
              data-locale=${locale || ''}
              @click=${this.handleFileInputToggleClick.bind(this)}>
            publish
          </i>
          <i
              class="material-icons selective__field__media_file__file_icon"
              title="Select pod path"
              data-locale=${locale || ''}
              @click=${this.handleFilesToggleClick.bind(this)}>
            list_alt
          </i>
        </div>
        ${fileListUi.renderFileList(selective, data, locale)}
        ${this.renderFileInput(selective, data, locale)}
        ${this.renderPreview(selective, data, locale)}
        ${this.renderLabelInput(selective, data, locale)}
        ${this.renderSubFields(selective, data, locale)}
      </div>`
  }

  renderInputLabel(selective, data, locale) {
    return html`
      <div class="selective__field__label selective__field__label--secondary">
        Media path
      </div>`
  }
}

// TODO: Move into the google media extension.
export class GoogleMediaField extends MediaField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'google_media'
    this.api = this.config.get('api')

    // TODO: Change to use the API after the extension is updated to the new
    // Extension style.
    // this._extension_config_promise = this.api.getExtensionConfig(
    //   'extensions.google_cloud_medias.GoogleCloudImageExtension')
    this._extension_config_promise = this.api.getExtensionConfig(
      'extensions.editor.EditorExtension')
  }

  getServingPath(value, locale) {
    if (!value || value == '') {
      return
    }

    if (FILE_EXT_REGEX.test(value)) {
      return value
    }

    // Add original size to the media so that we can get the full media specs.
    if (value.includes('googleusercontent') && !value.includes('=')) {
      return `${value}=s0`
    }

    return value
  }

  renderInputLabel(selective, data, locale) {
    return html`
      <div class="selective__field__label selective__field__label--secondary">
        Media url
      </div>`
  }

  uploadFile(file, locale) {
    const localeKey = this.keyForLocale(locale)

    // Wait for the url promise to return.
    this._extension_config_promise.then((result) => {
      const uploadUrl = result['googleMediaUploadUrl']
      const bucket = result['googleMediaBucket']

      if (!uploadUrl) {
        console.error('Unable to retrieve the upload url.');
        this._errors['uploadUrl'] = 'Unable to retrieve the upload url setting.'
        this.render()
        return
      }

      this.api.saveGoogleMedia(file, uploadUrl, bucket).then((result) => {
        this._showFileInput[localeKey] = false
        this._isLoading[localeKey] = false
        const value = this.getValueForLocale(locale) || {}
        this.setValueForLocale(locale, extend({}, value, {
          'url': result['url']
        }))
        this.render()
      }).catch((err) => {
        console.error(err)
        this._errors['upload'] = err
        this._showFileInput[localeKey] = false
        this._isLoading[localeKey] = false
        this.render()
      })
    })
  }
}
