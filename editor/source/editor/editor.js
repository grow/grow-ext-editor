/**
 * Content editor.
 */

import Config from '../utility/config'
import Document from './document'
import EditorApi from './editorApi'
import {
  html,
  repeat,
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
          <i class="material-icons" @click=${editor.handleMobileClick.bind(editor)}>devices</i>
          <i class="material-icons editor--mobile-only" @click=${editor.handleMobileRotateClick.bind(editor)}>screen_rotation</i>
          <i class="material-icons" @click=${editor.handleOpenInNew.bind(editor)}>open_in_new</i>
        </div>
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
      <div class="editor__preview">
        <iframe src="${editor.servingPath}"></iframe>
      </div>
    </div>`

    const EditorApiCls = this.config.get('EditorApiCls', EditorApi)
    this.api = new EditorApiCls()

    this.podPath = this.containerEl.dataset.defaultPath || ''
    this.document = null
    this.autosaveID = null

    // TODO: Read from local storage.
    this._isEditingSource = false
    this._isMobileRotated = false
    this._isMobileView = false

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
    return this.selective.isClean
  }

  get isEditingSource() {
    return this._isEditingSource
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
    return styles.join(' ')
  }

  get templateEditorOrSource() {
    if (this.isEditingSource) {
      return html`<div class="editor__source">
        Source!!!
      </div>`
    }
    return html`<div class="editor__selective">
      ${this.selective.template(this.selective, this.selective.data)}
    </div>`
  }

  set isEditingSource(value) {
    this._isEditingSource = value
    // TODO: Save to local storage.
  }

  set isMobileRotated(value) {
    this._isMobileRotated = value
    // TODO: Save to local storage.
  }

  set isMobileView(value) {
    this._isMobileView = value
    // TODO: Save to local storage.
  }

  bindEvents() {
    // Allow triggering a re-render.
    document.addEventListener('selective.render', () => {
      this.render()
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

    // TODO: Show only the source as a field.
    console.log('Show the fields...');

    this.render()
  }

  handleLoadFieldsResponse(response) {
    this._isEditingSource = false
    this.documentFromResponse(response)
    this.pushState(this.document.podPath)

    // Set the data from the document front matter.
    this.selective.data = this.document.data

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

  handleSaveFieldsResponse(response) {
    this.document.update(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'],
      response['content'])

    this.render()
  }

  handleSaveSourceResponse(response) {
    this.document.update(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'],
      response['content'])

    this.render()
  }

  handleSourceClick(evt) {
    this.isEditingSource = true

    // TODO: Show only the raw source as form field.
    console.log('Show the source...');

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

  render() {
    render(this.template(this, this.selective), this.containerEl)

    // Allow selective to run its post render process.
    this.selective.postRender(this.containerEl)
  }

  save(force) {
    if (this.isClean && !force) {
      // Already saved with no new changes.
      return
    } else if (this.isEditingSource) {
      // TODO: Retrieve the edited front matter.
      const rawFrontMatter = ''
      const result = this.api.saveDocumentSource(this.podPath, rawFrontMatter)
      result.then(this.handleSaveSourceResponse.bind(this))
    } else {
      const newFrontMatter = this.selective.value
      const content = newFrontMatter[CONTENT_KEY]
      delete newFrontMatter[CONTENT_KEY]
      const result = this.api.saveDocumentFields(
        this.podPath, newFrontMatter, this.document.locale, content)
      result.then(this.handleSaveFieldsResponse.bind(this))
    }
  }

  showFields() {
    this.containerEl.classList.remove('container--source')
    // TODO: Update to show all of the fields from the config.
  }

  showSource() {
    this.containerEl.classList.add('container--source')
    // TODO: Update to show the source field.
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
