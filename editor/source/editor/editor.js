/**
 * Content editor.
 */

import Config from '../utility/config'
import Listeners from '../utility/listeners'
import Document from './document'
import EditorApi from './editorApi'
import {
  html,
  render,
  repeat,
} from 'selective-edit'
import Selective from 'selective-edit'
import { defaultFields } from './field'
import { zoomIframe } from './zoomIframe'
import { findParentByClassname } from '../utility/dom'
import expandObject from '../utility/expandObject'


const CONTENT_KEY = '__content__'


export default class Editor {
  constructor(containerEl, config) {
    this.containerEl = containerEl
    this.config = new Config(config || {})
    this.template = (editor, selective) => html`<div class="editor ${editor.stylesEditor}">
      ${editor.renderEditor(editor, selective)}
      ${editor.renderPreview(editor, selective)}
    </div>`

    const EditorApiCls = this.config.get('EditorApiCls', EditorApi)
    this.api = new EditorApiCls()
    this.listeners = new Listeners()

    this._podPath = null
    this.podPath = this.containerEl.dataset.defaultPath || this.config.get('defaultPath', '')
    this.repo = null
    this.document = null
    this.autosaveID = null

    // TODO: Make devices configurable.
    this.devices = {
      desktop: {
        label: 'Desktop',
        width: 1024,
      },
      tablet: {
        label: 'Tablet',
        width: 768,
      },
      phone: {
        label: 'Phone',
        width: 411,
        height: 731,
      },
    }
    this._defaultDevice = 'desktop'
    this._device = localStorage.getItem('selective.device') || this._defaultDevice

    // Persistent settings in local storage.
    this._isEditingSource = localStorage.getItem('selective.isEditingSource') == 'true'
    this._isFullScreen = localStorage.getItem('selective.isFullScreen') == 'true'
    this._isHightlighted = localStorage.getItem('selective.isHightlighted') == 'true'
    this._isDeviceRotated = localStorage.getItem('selective.isDeviceRotated') == 'true'
    this._isDeviceView = localStorage.getItem('selective.isDeviceView') == 'true'
    this._isFullMarkdownEditor = false;

    this._isLoading = {}
    this._isSaving = false

    this._podPaths = null
    this._routes = null

    // Track the serving path of the iframe when it is different.
    this._unverifiedServingPath = null

    this.selective = new Selective(null, {})

    // Add the editor reference to the selective object for field access.
    this.selective.editor = this

    // Add the editor extension default field types.
    for (const key of Object.keys(defaultFields)) {
      this.selective.addFieldType(key, defaultFields[key])
    }

    this.bindEvents()
    this.bindKeyboard()

    this.load(this.podPath)

    // TODO Start the autosave depending on local storage.
    // this.startAutosave()
  }

  get device() {
    return this._device
  }

  get autosave() {
    // Always autosave for now.
    return true
  }

  get isClean() {
    return this.document.isClean && this.selective.isClean
  }

  get isEditingSource() {
    return this._isEditingSource
  }

  get isFullScreen() {
    // Default to full-screen mode for documents without serving paths.
    // TODO: We probably want to add a new checkbox to "disable the link"
    // between the preview and the editor. When the preview is disabled,
    // we do not want to override the full-screen setting. The goal is to
    // allow the user to be editing a partial document and then refresh the
    // full preview (corresponding to another doc), without having to
    // toggle the full-screen view.
    return this._isFullScreen || !this.servingPath
  }

  get isHightlighted() {
    return this._isHightlighted
  }

  get isDeviceRotated() {
    return this._isDeviceRotated
  }

  get isDeviceView() {
    return this._isDeviceView
  }

  get podPath() {
    return this._podPath
  }

  get previewUrl() {
    const params = '?editor=true'
    return `${this.servingPath}${params}`
  }

  get servingPath() {
    if (!this.document) {
      return ''
    }
    return this.document.servingPath
  }

  get stylesEditor() {
    const styles = []

    if (this.isDeviceView) {
      styles.push('editor--device')

      // Only allow the rotated when in device view.
      if (this.isDeviceRotated) {
        styles.push('editor--rotated')
      }
    }

    if (this.isEditingSource) {
      styles.push('editor--raw')
    }

    if (this.isFullScreen) {
      styles.push('editor--fullscreen')
    }

    if (this._isFullMarkdownEditor) {
      styles.push('editor--markdown')
    }

    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('highlight') || this.isHightlighted) {
      styles.push('editor--highlight')
    }

    return styles.join(' ')
  }

  get templateEditorOrSource() {
    if (this.isEditingSource) {
      return html`<div class="editor__source">
        <textarea @input=${this.handleRawInput.bind(this)}>${this.document.rawFrontMatter}</textarea>
      </div>`
    }
    return html`<div class="editor__selective">
      ${this.selective.template(this.selective, this.selective.data)}
    </div>`
  }

  set device(value) {
    this._device = value
    localStorage.setItem('selective.device', this._device)
  }

  set isEditingSource(value) {
    this._isEditingSource = value
    localStorage.setItem('selective.isEditingSource', this._isEditingSource)
  }

  set isFullScreen(value) {
    this._isFullScreen = value
    localStorage.setItem('selective.isFullScreen', this._isFullScreen)
  }

  set isHightlighted(value) {
    this._isHightlighted = value
    localStorage.setItem('selective.isHightlighted', this._isHightlighted)
  }

  set isDeviceRotated(value) {
    this._isDeviceRotated = value
    localStorage.setItem('selective.isDeviceRotated', this._isDeviceRotated)
  }

  set isDeviceView(value) {
    this._isDeviceView = value
    localStorage.setItem('selective.isDeviceView', this._isDeviceView)
  }

  set podPath(value) {
    this._podPath = value
    this.listeners.trigger('podPath', this._podPath)
  }

  _sizeLabel(device, rotate) {
    if (device.width && device.height) {
      if (rotate) {
        return `${device.height} x ${device.width}`
      }
      return `${device.width} x ${device.height}`
    }
    return device.width || device.height
  }

  adjustIframeSize() {
    const iframeContainerEl = this.containerEl.querySelector('.editor__preview__frame')
    const iframeEl = this.containerEl.querySelector('.editor__preview iframe')
    zoomIframe(
      iframeContainerEl, iframeEl, this.isDeviceView, this.isDeviceRotated,
      this.devices[this.device], 'editor__preview__frame--contained')
  }

  bindEvents() {
    // Rerender when window resizes.
    window.addEventListener('resize', (evt) => {
      this.render()
    })

    // Allow triggering a re-render.
    document.addEventListener('selective.render', (evt) => {
      const forceReload = (evt.detail && evt.detail['force'] == true)
      this.render(forceReload)
    })

    // Allow triggering a re-render.
    document.addEventListener('selective.path.update', (evt) => {
      const podPath = evt.detail['path']
      this.podPath = podPath
      this.load(podPath)
    })

    // Check for navigated iframe when the routes load.
    this.listeners.add('load.routes', this.verifyPreviewIframe.bind(this))
  }

  bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      // Save when using Ctrl+s or Command+s.
      if ((event.ctrlKey || event.metaKey) && event.key == 's') {
        event.preventDefault()
        this.save()
        return false
      }
      return true
    })
  }

  // When editing the pod path wait until the user stops typing before loading.
  delayPodPath() {
    this._lastPodPathUpdate = Date.now()
    setTimeout(() => {
      if (Date.now() - this._lastPodPathUpdate < 900) {
        return
      }
      this._lastPodPathUpdate = Date.now()
      this.load(this.podPath)
    }, 1000)
  }

  documentFromResponse(response) {
    this.document = new Document(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'],
      response['content'])
  }

  handleFieldsClick(evt) {
    this.isEditingSource = false
    this.render()
  }

  handleFullScreenClick(evt) {
    this.isFullScreen = !this.isFullScreen
    this.render()
  }

  handleHighlight(evt) {
    this.isHightlighted = !this.isHightlighted
    this.render()
  }

  handleLoadFieldsResponse(response) {
    this._isEditingSource = false
    this._isFullMarkdownEditor = false
    this.documentFromResponse(response)
    this.pushState(this.document.podPath)

    // Set the data from the document front matter.
    this.selective.data = this.document.data
    this.selective.fields.reset()

    // Load the field configuration from the response.
    let fieldConfigs = response['editor']['fields'] || []

    // If no fields defined, guess.
    if (!fieldConfigs.length) {
      const guessedFields = this.selective.guessFields()
      fieldConfigs = guessedFields['fields'] || []

      // Remove the content.
      let contentConfigIndex = null
      for (let i = 0; i < fieldConfigs.length; i++) {
        if (fieldConfigs[i].key == CONTENT_KEY) {
          contentConfigIndex = i
          break
        }
      }
      if (contentConfigIndex) {
        fieldConfigs.splice(contentConfigIndex, 1)
      }
    }

    for (const fieldConfig of fieldConfigs) {
      this.selective.addField(fieldConfig, {
        api: this.api,
      })
    }

    // Add the ability to edit the document body.
    if (response['content']) {
      let contentType = 'textarea'
      if (this.document.podPath.endsWith('.md')) {
        contentType = 'markdown'
        this._isFullMarkdownEditor = true
      }
      this.selective.addField({
        type: contentType,
        key: CONTENT_KEY,
        label: 'Content (Markdown)',
      }, {
        api: this.api,
      })
    }

    this.render()
  }

  handleLoadPodPaths(response) {
    this._podPaths = response['pod_paths']
    this.listeners.trigger('load.podPaths', {
      pod_paths: this._podPaths,
    })
  }

  handleLoadRoutes(response) {
    this._routes = response['routes']
    this.listeners.trigger('load.routes', {
      pod_paths: this._routes,
    })
  }

  handleLoadRepo(response) {
    this.repo = response['repo']
    this.listeners.trigger('load.repo', {
      repo: this.repo,
    })
  }

  handleLoadSourceResponse(response) {
    this._isEditingSource = true
    this.documentFromResponse(response)
    this.pushState(this.document.podPath)
    this.render()
  }

  handleDeviceRotateClick(evt) {
    this.isDeviceRotated = !this.isDeviceRotated
    this.render()
  }

  handleDeviceSwitchClick(evt) {
    const target = findParentByClassname(evt.target, 'editor__preview__size')
    this.device = target.dataset.device
    this.render()
  }

  handleDeviceToggleClick(evt) {
    this.isDeviceView = !this.isDeviceView
    this.render()
  }

  handleOpenInNew(evt) {
    window.open(this.previewUrl, '_blank')
  }

  handlePodPathChange(evt) {
    this.load(evt.target.value)
  }

  handlePodPathInput(evt) {
    this.delayPodPath(evt.target.value)
  }

  handlePreviewIframeNavigation(evt) {
    const newLocation = evt.target.contentWindow.location
    if (window.location.host != newLocation.host) {
      // Navigated away from the current site, ignore them.
      return
    }

    const newPath = newLocation.pathname
    if (newPath == this.servingPath) {
      // Check if the user navigated to the same page.
      return
    }

    // Mark the path as the latest path to check once the routes have loaded.
    // This allows the user to navigate a couple of times while the code is
    // waiting for the routes info to load and only update to the latest path.
    this._unverifiedServingPath = newPath

    // User has navigated to a new page on the same host.
    // If there is a document that has the same serving path switch the editor.
    this.verifyPreviewIframe()

    // Load the routes info if it has not loaded already.
    // The verify method is already bound to the loaded routes listener.
    this.loadRoutes()
  }

  handleRawInput(evt) {
    this.document.rawFrontMatter = evt.target.value
  }

  handleSaveError(err) {
    this._isSaving = false
    this.listeners.trigger('save.error', err)
    this.render()
  }

  handleSaveResponse(response, isAutosave) {
    this.document.update(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'],
      response['content'])

    this._isSaving = false
    this.listeners.trigger('save.response', response, isAutosave)

    this.render(true)
  }

  handleSourceClick(evt) {
    this.isEditingSource = true
    this.render()
  }

  load(podPath) {
    if (this.isEditingSource) {
      this.loadSource(podPath)
    } else {
      this.loadFields(podPath)
    }
  }

  loadFields(podPath) {
    this.api.getDocument(podPath).then(this.handleLoadFieldsResponse.bind(this))
  }

  loadPodPaths(force) {
    if (!force && this._isLoading['podPaths']) {
      // Already loading the pod paths, do not re-request.
      return
    }
    this._isLoading['podPaths'] = true
    this.api.getPodPaths().then(this.handleLoadPodPaths.bind(this))
  }

  loadRepo() {
    this.api.getRepo().then(this.handleLoadRepo.bind(this))
  }

  loadRoutes(force) {
    if (!force && this._isLoading['routes']) {
      // Already loading the pod paths, do not re-request.
      return
    }
    this._isLoading['routes'] = true
    this.api.getRoutes().then(this.handleLoadRoutes.bind(this))
  }

  loadSource(podPath) {
    this.api.getDocument(podPath).then(this.handleLoadSourceResponse.bind(this))
  }

  pushState(podPath) {
    // Update the url if the document loaded is a different pod path.
    const basePath = this.config.get('base', '/_grow/editor')
    const origPath = window.location.pathname
    const newPath = `${basePath}${podPath}`
    if (origPath != newPath) {
      history.pushState({}, '', newPath)
    }
  }

  render(force) {
    render(this.template(this, this.selective), this.containerEl)

    // Adjust the iframe size.
    this.adjustIframeSize()

    // Allow selective to run its post render process.
    this.selective.postRender(this.containerEl)

    if (force === true) {
      // Force a reload when neccesary.
      // Test for iframe first, as it may be hidden.
      const iframe = this.containerEl.querySelector('iframe')
      iframe && iframe.contentWindow.location.reload(true)
    }
  }

  renderEditor(editor, selective) {
    return html`<div class="editor__edit">
      <div class="editor__pod_path">
        <input type="text" value="${editor.podPath}"
          @change=${editor.handlePodPathChange.bind(editor)}
          @input=${editor.handlePodPathInput.bind(editor)}>
        <i class="material-icons" @click=${editor.handleFullScreenClick.bind(editor)} title="Fullscreen">${editor.isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</i>
      </div>
      <div class="editor__cards">
        <div class="editor__card">
          <div class="editor__menu">
            <button
                ?disabled=${editor._isSaving || editor.isClean}
                class="editor__save editor--primary ${editor._isSaving ? 'editor__save--saving' : ''}"
                @click=${() => editor.save()}>
              ${editor.isClean ? 'No changes' : editor._isSaving ? 'Saving...' : 'Save'}
            </button>
            <div class="editor__actions">
              <button class="editor__style__fields editor--secondary editor--selected" @click=${editor.handleFieldsClick.bind(editor)}>Fields</button>
              <button class="editor__style__raw editor--secondary" @click=${editor.handleSourceClick.bind(editor)}>Raw</button>
            </div>
          </div>
          ${editor.templateEditorOrSource}
        </div>
        <div class="editor__dev_tools">
          <div>Developer tools:</div>
          <i
              class="editor__dev_tools__icon ${editor.isHightlighted ? 'editor__dev_tools__icon--selected': ''} material-icons"
              @click=${editor.handleHighlight.bind(editor)}
              title="Highlight auto fields">
            highlight
          </i>
        </div>
      </div>
    </div>`
  }

  renderPreview(editor, selective) {
    if (editor.isFullScreen) {
      return ''
    }

    let previewSizes = ''
    if (editor.isDeviceView) {
      previewSizes = html`<div class="editor__preview__sizes">
        ${repeat(Object.entries(this.devices), (device) => device[0], (device, index) => html`
          <div
              class="editor__preview__size ${editor.device == device[0] ? 'editor__preview__size--selected' : ''}"
              data-device="${device[0]}"
              @click=${editor.handleDeviceSwitchClick.bind(editor)}>
            ${device[1].label}
            <span class="editor__preview__size__dimension">
              (${editor._sizeLabel(device[1], editor.isDeviceRotated)})
            </span>
          </div>`)}
      </div>`
    }

    return html`<div class="editor__preview">
      <div class="editor__preview__header">
        <div class="editor__preview__header__label">
          Preview
        </div>
        ${previewSizes}
        <div class="editor__preview__header__icons">
          ${editor.isFullScreen ? '' : html`
            <i class="material-icons" @click=${editor.handleDeviceToggleClick.bind(editor)} title="Toggle device view">devices</i>
            <i class="material-icons editor--device-only" @click=${editor.handleDeviceRotateClick.bind(editor)} title="Rotate device view">screen_rotation</i>
          `}
          <i class="material-icons" @click=${editor.handleOpenInNew.bind(editor)} title="Preview in new window">open_in_new</i>
        </div>
      </div>
      <div class="editor__preview__frame">
        <iframe src="${editor.previewUrl}" @load=${editor.handlePreviewIframeNavigation.bind(editor)}></iframe>
      </div>
    </div>`
  }

  save(force, isAutosave) {
    if (!force && this.isClean) {
      // Already saved with no new changes.
      return
    }

    this._isSaving = true
    this.render()

    this.listeners.trigger('save.start', {
      isEditingSource: this.isEditingSource,
    })
    if (this.isEditingSource) {
      const result = this.api.saveDocumentSource(
        this.podPath, this.document.rawFrontMatter)
      result.then((response) => this.handleSaveResponse(response, isAutosave))
      result.catch((err) => this.handleSaveError(err))
    } else {
      const newFrontMatter = this.selective.value
      const content = newFrontMatter[CONTENT_KEY]
      delete newFrontMatter[CONTENT_KEY]
      const result = this.api.saveDocumentFields(
        this.podPath, newFrontMatter, this.document.locale, content)
      result.then((response) => this.handleSaveResponse(response, isAutosave))
      result.catch((err) => this.handleSaveError(err))
    }
  }

  startAutosave() {
    if (this.autosaveID) {
      window.clearInterval(this.autosaveID)
    }

    this.autosaveID = window.setInterval(() => {
      this.save(false, true)
    }, this.config.get('autosaveInterval', 2000))
  }

  stopAutosave() {
    if (this.autosaveID) {
      window.clearInterval(this.autosaveID)
    }
  }

  verifyPreviewIframe() {
    if (!this._unverifiedServingPath || !this._routes) {
      return
    }

    if (this._unverifiedServingPath in this._routes) {
      const match = this._routes[this._unverifiedServingPath]
      this.podPath = match['pod_path']
      this.load(this.podPath)
    }
  }
}
