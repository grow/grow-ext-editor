/**
 * Content editor.
 */

import Config from '../utility/config'
import Document from './document'
import EditorApi from './editorApi'
import Selective from 'selective-edit'
import { MDCIconButtonToggle } from '@material/icon-button/index'
import { MDCLinearProgress } from '@material/linear-progress/index'
import { MDCRipple } from '@material/ripple/index'
import { MDCSwitch } from '@material/switch/index'
import { MDCTextField } from '@material/textfield/index'
import { defaultFields } from './field'
import expandObject from '../utility/expandObject'


export default class Editor {
  constructor(containerEl, config) {
    this.containerEl = containerEl
    this.config = new Config(config || {})
    this.mobileToggleEl = this.containerEl.querySelector('#content_device')
    this.sourceToggleEl = this.containerEl.querySelector('#content_source')
    this.contentPreviewEl = this.containerEl.querySelector('.content__preview')
    this.autosaveEl = this.containerEl.querySelector('.sidebar__save__auto .mdc-switch')
    this.autosaveToggleEl = this.containerEl.querySelector('#autosave')
    this.previewEl = this.containerEl.querySelector('.preview')
    this.fieldsEl = this.containerEl.querySelector('.fields')
    this.saveEl = this.containerEl.querySelector('.sidebar__save .mdc-button')
    this.podPathEl = this.containerEl.querySelector('#pod_path')
    this.host = this.previewEl.dataset.host
    this.port = this.previewEl.dataset.port
    this.document = null
    this.autosaveID = null
    this._isEditingSource = false

    this.selective = new Selective(this.fieldsEl, {})

    this.autosaveToggleEl.addEventListener('click', this.handleAutosaveClick.bind(this))
    this.saveEl.addEventListener('click', () => { this.save(true) })
    this.podPathEl.addEventListener('change', () => { this.load(this.podPath) })
    this.podPathEl.addEventListener('keyup', () => { this.delayPodPath() })

    this.saveEl = MDCRipple.attachTo(this.autosaveEl)
    this.autoSaveMd = MDCSwitch.attachTo(this.autosaveEl)
    this.mobileToggleMd = MDCIconButtonToggle.attachTo(this.mobileToggleEl)
    this.mobileToggleEl.addEventListener(
      'MDCIconButtonToggle:change', this.handleMobileClick.bind(this))
    this.sourceToggleMd = MDCIconButtonToggle.attachTo(this.sourceToggleEl)
    this.sourceToggleEl.addEventListener(
      'MDCIconButtonToggle:change', this.handleSourceClick.bind(this))
    this.podPathMd = new MDCTextField(
      this.containerEl.querySelector('.content__path .mdc-text-field'))
    this.saveProgressMd = MDCLinearProgress.attachTo(
      this.containerEl.querySelector('.sidebar__save .mdc-linear-progress'))

    // Turn off the progress bar until saving.
    this.saveProgressMd.close()

    this.api = new EditorApi({
      host: this.host,
      port: this.port,
    })

    // Add the editor extension default field types.
    for (const key of Object.keys(defaultFields)) {
      this.selective.addFieldType(key, defaultFields[key])
    }

    // Default to loading with the UI.
    this.load(this.podPath)

    // TODO Start the autosave depending on local storage.
    // this.startAutosave()
  }

  get autosave() {
    return this.autosaveToggleEl.checked
  }

  get isClean() {
    return this.selective.isClean
  }

  get isEditingSource() {
    return this._isEditingSource
  }

  get podPath() {
    return this.podPathEl.value
  }

  get previewUrl() {
    return `http://${this.host}:${this.port}${this.servingPath}`
  }

  get servingPath() {
    if (!this.document) {
      return ''
    }
    return this.document.servingPath
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

  handleAutosaveClick(evt) {
    if (this.autosaveToggleEl.checked) {
      this.startAutosave()
    } else {
      this.stopAutosave()
    }
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
        if (fieldConfigs[i].key == '__content__') {
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
        key: "__content__",
        label: "Content",
        api: this.api,
      })
    }

    this.selective.render()
    this.refreshPreview()
  }

  handleLoadSourceResponse(response) {
    this._isEditingSource = true
    this.documentFromResponse(response)
    this.pushState(this.document.podPath)
    this.refreshPreview()
  }

  handleMobileClick(evt) {
    if (evt.detail.isOn) {
      this.containerEl.classList.add('container--mobile')
      this.previewEl.classList.add('mdc-elevation--z4')
    } else {
      this.containerEl.classList.remove('container--mobile')
      this.previewEl.classList.remove('mdc-elevation--z4')
    }
  }

  handleSaveFieldsResponse(response) {
    this.saveProgressMd.close()
    this.document.update(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'])

    this.refreshPreview()
  }

  handleSaveSourceResponse(response) {
    this.saveProgressMd.close()
    this.document.update(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'])

    this.refreshPreview()
  }

  handleSourceClick(evt) {
    this.load(this.podPath)
  }

  load(podPath) {
    if (this.sourceToggleMd.on) {
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

  refreshPreview() {
    if (this.previewEl.src == this.previewUrl) {
      this.previewEl.contentWindow.location.reload(true)
    } else {
      this.previewEl.src = this.previewUrl
    }
  }

  save(force) {
    this.saveProgressMd.open()
    if (this.isClean && !force) {
      // Already saved with no new changes.
      this.saveProgressMd.close()
    } else if (this.isEditingSource) {
      // TODO: Retrieve the edited front matter.
      const rawFrontMatter = ''
      const result = this.api.saveDocumentSource(this.podPath, rawFrontMatter)
      result.then(this.handleSaveSourceResponse.bind(this))
    } else {
      // TODO: Retrieve the updated front matter value.
      const newFrontMatter = this.selective.value
      const result = this.api.saveDocumentFields(this.podPath, newFrontMatter, this.document.locale)
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

    this.autosaveToggleEl.checked = true
  }

  stopAutosave() {
    if (this.autosaveID) {
      window.clearInterval(this.autosaveID)
    }

    this.autosaveToggleEl.checked = false
  }
}
