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
} from 'selective-edit'
import Selective from 'selective-edit'
import { defaultFields } from './field'
import expandObject from '../utility/expandObject'


const CONTENT_KEY = '__content__'


export default class Editor {
  constructor(containerEl, config) {
    this.containerEl = containerEl
    this.config = new Config(config || {})
    this.template = (editor, selective) => html`<div class="editor ${editor.stylesEditor}">
      <div class="editor__edit">
        <div class="editor__pod_path">
          <input type="text" value="${editor.podPath}"
            @change=${editor.handlePodPathChange.bind(editor)}
            @input=${editor.handlePodPathInput.bind(editor)}>
          ${editor.isFullScreen ? '' : html`
            <i class="material-icons" @click=${editor.handleMobileClick.bind(editor)}>devices</i>
            <i class="material-icons editor--mobile-only" @click=${editor.handleMobileRotateClick.bind(editor)}>screen_rotation</i>
          `}
          <i class="material-icons" @click=${editor.handleFullScreenClick.bind(editor)}>${editor.isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</i>
          <i class="material-icons" @click=${editor.handleOpenInNew.bind(editor)}>open_in_new</i>
        </div>
        <div class="editor__cards">
          <div class="editor__card">
            <div class="editor__menu">
              <button class="editor__save editor--primary" @click=${editor.save.bind(editor)}>Save</button>
              <div class="editor__actions">
                <button class="editor__style__fields editor--secondary editor--selected" @click=${editor.handleFieldsClick.bind(editor)}>Fields</button>
                <button class="editor__style__raw editor--secondary" @click=${editor.handleSourceClick.bind(editor)}>Raw</button>
              </div>
            </div>
            ${editor.templateEditorOrSource}
          </div>
        </div>
      </div>
      ${editor.isFullScreen ? '' : html`<div class="editor__preview">
        <iframe src="${editor.servingPath}"></iframe>
      </div>`}
    </div>`

    const EditorApiCls = this.config.get('EditorApiCls', EditorApi)
    this.api = new EditorApiCls()
    this.listeners = new Listeners()

    this.podPath = this.containerEl.dataset.defaultPath || this.config.get('defaultPath', '')
    this.repo = null
    this.document = null
    this.autosaveID = null

    // Persistent settings in local storage.
    this._isEditingSource = localStorage.getItem('selective.isEditingSource') == 'true'
    this._isFullScreen = localStorage.getItem('selective.isFullScreen') == 'true'
    this._isMobileRotated = localStorage.getItem('selective.isMobileRotated') == 'true'
    this._isMobileView = localStorage.getItem('selective.isMobileView') == 'true'

    this._isLoading = {}

    this.selective = new Selective(null, {})

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
    return this._isFullScreen
  }

  get isMobileRotated() {
    return this._isMobileRotated
  }

  get isMobileView() {
    return this._isMobileView
  }

  get previewUrl() {
    return this.servingPath
  }

  get servingPath() {
    if (!this.document) {
      return ''
    }
    return this.document.servingPath
  }

  get stylesEditor() {
    const styles = []

    if (this.isMobileView) {
      styles.push('editor--mobile')

      // Only allow the rotated when in mobile view.
      if (this.isMobileRotated) {
        styles.push('editor--rotated')
      }
    }

    if (this.isEditingSource) {
      styles.push('editor--raw')
    }

    if (this.isFullScreen) {
      styles.push('editor--fullscreen')
    }

    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('highlight')) {
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

  set isEditingSource(value) {
    this._isEditingSource = value
    localStorage.setItem('selective.isEditingSource', this._isEditingSource)
  }

  set isFullScreen(value) {
    this._isFullScreen = value
    localStorage.setItem('selective.isFullScreen', this._isFullScreen)
  }

  set isMobileRotated(value) {
    this._isMobileRotated = value
    localStorage.setItem('selective.isMobileRotated', this._isMobileRotated)
  }

  set isMobileView(value) {
    this._isMobileView = value
    localStorage.setItem('selective.isMobileView', this._isMobileView)
  }

  bindEvents() {
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

  handleLoadFieldsResponse(response) {
    this._isEditingSource = false
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
      // Allow the fields to use the API if needed.
      fieldConfig['api'] = this.api
      this.selective.addField(fieldConfig)
    }

    // Add the ability to edit the document body.
    if (response['content']) {
      let contentType = 'textarea'
      if (this.document.podPath.endsWith('.md')) {
        contentType = 'markdown'
      }
      this.selective.addField({
        type: contentType,
        key: CONTENT_KEY,
        label: 'Content',
        api: this.api,
      })
    }

    this.render()
  }

  handleLoadPodPaths(response) {
    this._pod_paths = response['pod_paths']
    this.listeners.trigger('load.podPaths', {
      pod_paths: this._pod_paths,
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

  handleMobileRotateClick(evt) {
    this.isMobileRotated = !this.isMobileRotated
    this.render()
  }

  handleMobileClick(evt) {
    this.isMobileView = !this.isMobileView
    this.render()
  }

  handleOpenInNew(evt) {
    window.open(this.servingPath, '_blank')
  }

  handlePodPathChange(evt) {
    this.load(evt.target.value)
  }

  handlePodPathInput(evt) {
    this.delayPodPath(evt.target.value)
  }

  handleRawInput(evt) {
    this.document.rawFrontMatter = evt.target.value
  }

  handleSaveResponse(response) {
    this.document.update(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'],
      response['content'])

    this.listeners.trigger('save.response', {
      response: response,
    })

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

    // Allow selective to run its post render process.
    this.selective.postRender(this.containerEl)

    if (force === true) {
      // Force a reload when neccesary.
      const iframe = this.containerEl.querySelector('iframe')
      iframe.contentWindow.location.reload(true)
    }
  }

  save(force) {
    if (!force && this.isClean) {
      // Already saved with no new changes.
      return
    }

    this.listeners.trigger('save.start', {
      isEditingSource: this.isEditingSource,
    })
    if (this.isEditingSource) {
      const result = this.api.saveDocumentSource(
        this.podPath, this.document.rawFrontMatter)
      result.then(this.handleSaveResponse.bind(this))
    } else {
      const newFrontMatter = this.selective.value
      const content = newFrontMatter[CONTENT_KEY]
      delete newFrontMatter[CONTENT_KEY]
      const result = this.api.saveDocumentFields(
        this.podPath, newFrontMatter, this.document.locale, content)
      result.then(this.handleSaveResponse.bind(this))
    }
  }

  startAutosave() {
    if (this.autosaveID) {
      window.clearInterval(this.autosaveID)
    }

    this.autosaveID = window.setInterval(() => {
      this.save()
    }, this.config.get('autosaveInterval', 2000))
  }

  stopAutosave() {
    if (this.autosaveID) {
      window.clearInterval(this.autosaveID)
    }
  }
}
