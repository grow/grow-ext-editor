/**
 * Content editor.
 */

import CodeMirror from 'codemirror/lib/codemirror.js'
import 'codemirror/mode/htmlmixed/htmlmixed.js'
import 'codemirror/mode/markdown/markdown.js'
import 'codemirror/mode/yaml/yaml.js'
import { dump } from 'js-yaml/lib/js-yaml.js'
import {
  html,
  render,
  repeat,
} from 'selective-edit'
import Selective from 'selective-edit'
import Config from '../utility/config'
import Listeners from '../utility/listeners'
import Document from './document'
import EditorApi from './editorApi'
import Menu from './menu/menu'
import EditorAutoFields from './autoFields'
import { defaultFields } from './field'
import { zoomIframe } from './zoomIframe'
import { findParentByClassname } from '../utility/dom'
import expandObject from '../utility/expandObject'
import Storage from '../utility/storage'


const CONTENT_KEY = '__content__'
const CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  tabSize: 2,
  theme: 'elegant',
}


export default class Editor {
  constructor(containerEl, config) {
    this.containerEl = containerEl
    this.config = new Config(config || {})
    this.template = (editor, selective) => html`<div class="editor ${editor.stylesEditor}">
      ${this.menu.template(editor)}
      ${editor.renderEditor(editor, selective)}
      ${editor.renderPreview(editor, selective)}
    </div>`
    this.storage = new Storage(this.isTesting)

    const EditorApiCls = this.config.get('EditorApiCls', EditorApi)
    this.api = new EditorApiCls()
    this.listeners = new Listeners()

    this.menu = new Menu({
      testing: this.isTesting,
    }, this)

    this._podPath = null
    this.podPath = this.containerEl.dataset.defaultPath || this.config.get('defaultPath', '')
    this.repo = null
    this.document = null
    this.autosaveID = null

    this.urlParams = new URLSearchParams(window.location.search)

    // TODO: Make devices configurable.
    this.devices = {
      desktop: {
        label: 'Desktop',
        width: 1440,
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
    this._device = this.storage.getItem('selective.device') || this._defaultDevice

    // Persistent settings in local storage.
    this._isEditingSource = this.storage.getItem('selective.isEditingSource') == 'true'
    this._isFullScreen = this.storage.getItem('selective.isFullScreen') == 'true'
    this._isHighlighted = {
      dirty: this.storage.getItem('selective.isHightlighted.dirty') == 'true',
      guess: this.storage.getItem('selective.isHightlighted.guess') == 'true',
      linked: this.storage.getItem('selective.isHightlighted.linked') == 'true',
    }

    this._isDeviceRotated = this.storage.getItem('selective.isDeviceRotated') == 'true'
    this._isDeviceView = this.storage.getItem('selective.isDeviceView') == 'true'
    this._isFullMarkdownEditor = false;
    this._hasLoadedFields = false;

    this._isLoading = {}
    this._isSaving = false
    this._isRendering = false
    this._pendingRender = false

    this._codeMirrors = {}

    this._podPaths = null
    this._routes = null
    this._strings = null
    this._templates = null

    // Track the serving path of the iframe when it is different.
    this._unverifiedServingPath = null

    this.selective = new Selective(null, {
      AutoFieldsCls: EditorAutoFields,
    })

    // Add the editor reference to the selective object for field access.
    this.selective.editor = this

    // Load the selective editor preference for localize.
    this.selective.localize = this.storage.getItem('selective.localize') == 'true'

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

  get isDeviceRotated() {
    return this._isDeviceRotated
  }

  get isDeviceView() {
    return this._isDeviceView
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

  get isTesting() {
    return this.config.get('testing', false)
  }

  get linkedFields() {
    const fieldRaw = this.urlParams.get('field')

    if (!fieldRaw) {
      return []
    }
    return fieldRaw.split(',')
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

    if (this.isHightlighted('guess')) {
      styles.push('editor--highlight-guess')
    }

    if (this.isHightlighted('dirty')) {
      styles.push('editor--highlight-dirty')
    }

    if (this.isHightlighted('linked')) {
      styles.push('editor--highlight-linked')
    }

    return styles.join(' ')
  }

  get templateEditorOrSource() {
    if (this.isEditingSource) {
      const contentHtml = this.document.content != ''
        ? html`
          <div class="editor__source__section">
            <div class="editor__source__title">Content</div>
            <textarea class="editor__source__content" @input=${this.handleRawContent.bind(this)}>${this.document.content}</textarea>
          </div>`
        : ''

      return html`<div class="editor__source">
        <div class="editor__source__section">
          <div class="editor__source__title">Front Matter</div>
          <textarea class="editor__source__frontmatter" @input=${this.handleRawInput.bind(this)}>${this.document.rawFrontMatter}</textarea>
        </div>
        ${contentHtml}
      </div>`
    }
    return html`<div class="editor__selective">
      ${this.selective.template(this.selective, this.selective.data)}
    </div>`
  }

  set device(value) {
    this._device = value
    this.storage.setItem('selective.device', this._device)
  }

  set isEditingSource(value) {
    this._isEditingSource = value
    this.storage.setItem('selective.isEditingSource', this._isEditingSource)
  }

  set isFullScreen(value) {
    this._isFullScreen = value
    this.storage.setItem('selective.isFullScreen', this._isFullScreen)
  }

  set isDeviceRotated(value) {
    this._isDeviceRotated = value
    this.storage.setItem('selective.isDeviceRotated', this._isDeviceRotated)
  }

  set isDeviceView(value) {
    this._isDeviceView = value
    this.storage.setItem('selective.isDeviceView', this._isDeviceView)
  }

  set podPath(value) {
    this._podPath = value.trim()
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

    // Allow copying files.
    document.addEventListener('selective.path.copy', (evt) => {
      const podPath = evt.detail['path']
      const parts = podPath.split('/')
      const fileName = parts.pop()
      const fileNameParts = fileName.split('.')
      const fileNameExt = fileNameParts.pop()
      const fileNameBase = fileNameParts.join('.')
      const newFileNameBase = window.prompt(`Enter the new file name for the duplicate of ${fileNameBase}`, fileNameBase);
      parts.push([newFileNameBase, fileNameExt].join('.'))
      const newPodPath = parts.join('/')
      this.api.copyFile(podPath, newPodPath).then(() => {
        if (this._podPaths) {
          this.loadPodPaths(true)
        }
      }).catch((error) => {
        console.error(error)
      })
    })

    // Allow deleting files.
    document.addEventListener('selective.path.delete', (evt) => {
      const podPath = evt.detail['path']

      this.api.deleteFile(podPath).then(() => {
        if (this._podPaths) {
          this.loadPodPaths(true)
        }
      }).catch((error) => {
        console.error(error)
      })
    })

    // Allow new files from templates.
    document.addEventListener('selective.path.template', (evt) => {
      const collectionPath = evt.detail['collectionPath']
      const fileName = evt.detail['fileName']
      const template = evt.detail['template']
      this.api.templateFile(collectionPath, template, fileName).then(() => {
        if (this._podPaths) {
          this.loadPodPaths(true)
        }
      }).catch((error) => {
        console.error(error)
      })
    })

    // Allow triggering a new pod path to load.
    document.addEventListener('selective.path.update', (evt) => {
      const podPath = evt.detail['path']
      this.podPath = podPath
      this.load(podPath)
    })

    // Watch for the deep link event.
    document.addEventListener('selective.field.deep_link', (evt) => {
      const linkedField = evt.detail.field
      const operation = evt.detail.operation
      if (operation == 'toggle') {
        // Allow for linking to multiple fields at once.
        let newField = (this.urlParams.get('field') || '').split(',')
        if (newField.includes(linkedField)) {
          // Remove existing item.
          newField = newField.filter(item => item !== linkedField)
        } else {
          // Add as new item.
          newField.push(linkedField)
        }
        newField.sort()
        this.urlParams.set('field', newField.join(','))
      } else {
        this.urlParams.set('field', linkedField)
      }
      this.pushState(this.document.podPath, this.urlParams.toString())
      this.render()
    })

    // Check for navigated iframe when the routes load.
    this.listeners.add('load.routes', this.verifyPreviewIframe.bind(this))

    // Watch for the history popstate.
    window.addEventListener('popstate', this.popState.bind(this))

    // Message when there are pending changes.
    window.addEventListener('beforeunload', (evt) => {
      if (!this.isClean) {
        evt.preventDefault()
        evt.returnValue = ''  // Chrome requires returnValue to be set.
      }
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
      response['locales'],
      response['content'],
      response['hash'])
  }

  handleFieldsClick(evt) {
    this.isEditingSource = false

    // Need to remove the code mirror for source since it no longer exists.
    delete this._codeMirrors['source']
    delete this._codeMirrors['content']

    // Handle the case that the field information has not been loaded yet.
    if (!this._hasLoadedFields) {
      this.load(this.podPath)
    }

    this.render()
  }

  handleFullScreenClick(evt) {
    this.isFullScreen = !this.isFullScreen
    this.render()
  }

  handleHighlightDirty(evt) {
    this._isHighlighted.dirty = !this.isHightlighted('dirty')
    this.storage.setItem('selective.isHightlighted.dirty', this._isHighlighted.dirty)

    this.render()
  }

  handleHighlightGuess(evt) {
    this._isHighlighted.guess = !this.isHightlighted('guess')
    this.storage.setItem('selective.isHightlighted.guess', this._isHighlighted.guess)

    this.render()
  }

  handleHighlightLinked(evt) {
    this._isHighlighted.linked = !this.isHightlighted('linked')
    this.storage.setItem('selective.isHightlighted.linked', this._isHighlighted.linked)

    this.render()
  }

  handleLoadFieldsResponse(response) {
    this._hasLoadedFields = true
    this._isEditingSource = false
    this._isFullMarkdownEditor = false
    this.documentFromResponse(response)
    this.pushState(this.document.podPath)

    // Set the data from the document front matter.
    this.selective.data = this.document.data
    this.selective.config.set('defaultLocale', this.document.defaultLocale)
    this.selective.config.set('locales', this.document.locales)
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

      for (const fieldConfig of fieldConfigs) {
        fieldConfig.isGuessed = true
      }
    }

    for (const fieldConfig of fieldConfigs) {
      this.selective.addField(fieldConfig, {
        api: this.api,
        linkedFieldsFunc: () => this.linkedFields,
        AutoFieldsCls: EditorAutoFields,
      })
    }

    // Add the ability to edit the document body.
    if (response['content']) {
      let contentType = 'textarea'
      if (this.document.podPath.endsWith('.md')) {
        contentType = 'markdown'
        this._isFullMarkdownEditor = true
      } else if (this.document.podPath.endsWith('.html')) {
        contentType = 'html'
        this._isFullMarkdownEditor = true
      }

      this.selective.addField({
        classes: ['selective__field__type__html--content'],
        type: contentType,
        key: CONTENT_KEY,
        label: 'Content',
      }, {
        api: this.api,
        linkedFieldsFunc: () => this.linkedFields,
        AutoFieldsCls: EditorAutoFields,
      })
    }

    this.scrollToLinkedField()  // On load watch for selected fields.
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

  handleLoadPod(response) {
    this._pod = response['pod']
    this.listeners.trigger('load.pod', {
      pod: this._pod,
    })
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
      routes: this._routes,
    })
  }

  handleLoadRepo(response) {
    this.repo = response['repo']
    this.listeners.trigger('load.repo', {
      repo: this.repo,
    })
  }

  handleLoadTemplates(response) {
    this._templates = response['templates']
    this.listeners.trigger('load.templates', {
      templates: this._templates,
    })

    // Check for missing screenshots.
    for (const collectionPath of Object.keys(this._templates)) {
      const template = this._templates[collectionPath]
      for (const key of Object.keys(template)) {
        const templateMeta = template[key]
        const screenshots = templateMeta.screenshots

        // Missing template screenshot. Request it.
        if (!Object.keys(screenshots).length) {
          this.api.screenshotTemplate(collectionPath, key).then((response) => {
            for (const responseCollection of Object.keys(response)) {
              templateMeta.screenshots = response[collectionPath + '/'][key]
              this.listeners.trigger('load.templates', {
                templates: this._templates,
              })
            }
          })
        }
      }
    }
  }

  handleLoadSourceResponse(response) {
    this._isEditingSource = true
    this.documentFromResponse(response)
    this.pushState(this.document.podPath)
    this.render()
  }

  handleLoadStrings(response) {
    this._strings = response['strings']
    this.listeners.trigger('load.strings', {
      strings: this._strings,
    })
  }

  handleLocalize(evt) {
    this.selective.localize = !this.selective.localize
    this.storage.setItem('selective.localize', this.selective.localize)
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

  handleRawContent(evt) {
    this.document.content = evt.target.value
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
    this.updateDocumentFromResponse(response)
    this.selective.data = this.document.data

    this._isSaving = false
    this.listeners.trigger('save.response', response, isAutosave)

    // Unlock any locked fields to allow the new data to update.
    // Ex: list sorting or deleting locks fields.
    document.dispatchEvent(new CustomEvent('selective.unlock'))

    this.render(true)
  }

  handleSourceClick(evt) {
    if (!this.isEditingSource && !this.isClean) {
      const newFrontMatter = this.selective.value
      const content = newFrontMatter[CONTENT_KEY]
      delete newFrontMatter[CONTENT_KEY]
      this.document.rawFrontMatter = dump(newFrontMatter)
      this.document.content = content
    }

    this.isEditingSource = true
    this.render()
  }

  isHightlighted(key) {
    return this._isHighlighted[key]
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

  loadPod(force) {
    if (!force && this._isLoading['pod']) {
      // Already loading, do not re-request.
      return
    }
    this._isLoading['pod'] = true
    this.api.getPod().then(this.handleLoadPod.bind(this))
  }

  loadPodPaths(force) {
    if (!force && this._isLoading['podPaths']) {
      // Already loading, do not re-request.
      return
    }
    this._isLoading['podPaths'] = true
    this.api.getPodPaths().then(this.handleLoadPodPaths.bind(this))
  }

  loadRepo(force) {
    if (!force && this._isLoading['repo']) {
      // Already loading, do not re-request.
      return
    }
    this._isLoading['repo'] = true
    this.api.getRepo().then(this.handleLoadRepo.bind(this))
  }

  loadRoutes(force) {
    if (!force && this._isLoading['routes']) {
      // Already loading, do not re-request.
      return
    }
    this._isLoading['routes'] = true
    this.api.getRoutes().then(this.handleLoadRoutes.bind(this))
  }

  loadSource(podPath) {
    this.api.getDocument(podPath).then(this.handleLoadSourceResponse.bind(this))
  }

  loadStrings(force) {
    if (!force && this._isLoading['strings']) {
      // Already loading, do not re-request.
      return
    }
    this._isLoading['strings'] = true
    this.api.getStrings().then(this.handleLoadStrings.bind(this))
  }

  loadTemplates(force) {
    if (!force && this._isLoading['templates']) {
      // Already loading, do not re-request.
      return
    }
    this._isLoading['templates'] = true
    this.api.getTemplates().then(this.handleLoadTemplates.bind(this))
  }

  popState(evt) {
    if (evt.state.podPath) {
      this.podPath = evt.state.podPath
      this.urlParams = new URLSearchParams(window.location.search)
      this.load(this.podPath)
    }
  }

  pushState(podPath, paramString) {
    // Update the url if the document loaded is a different pod path.
    const basePath = this.config.get('base', '/_grow/editor')
    const origPath = window.location.pathname
    const newPath = `${basePath}${podPath}${paramString ? `?${paramString}` : ''}`
    if (origPath != newPath && !this.testing) {
      history.pushState({
        'podPath': podPath,
        'paramString': paramString,
      }, '', newPath)
    }
  }

  render(force) {
    // Render only one at a time.
    if (this._isRendering) {
      this._pendingRender = {
        force: (this._pendingRender.force ? this._pendingRender.force || force : force)
      }
      return
    }

    this._isRendering = true

    const isClean = this.isClean

    render(this.template(this, this.selective), this.containerEl)

    // Check for clean changes not caught.
    if (this.isClean != isClean) {
      this._isRendering = false
      this.render(force)
      return
    }

    // Adjust the iframe size.
    this.adjustIframeSize()

    // Make the code editor if editing raw.
    if(this.isEditingSource && !this._codeMirrors['source']) {
      const frontmatterTextarea = this.containerEl.querySelector('.editor__source textarea.editor__source__frontmatter')
      this._codeMirrors['source'] = CodeMirror.fromTextArea(frontmatterTextarea, Object.assign({}, CODEMIRROR_OPTIONS, {
        mode: 'yaml',
      }))
      this._codeMirrors['source'].on('change', (cMirror) => {
        this.document.rawFrontMatter = cMirror.getValue()
        this.render()
      })
    }

    if(this.isEditingSource && !this._codeMirrors['content']) {
      const contentTextarea = this.containerEl.querySelector('.editor__source textarea.editor__source__content')
      if (contentTextarea) {
        this._codeMirrors['content'] = CodeMirror.fromTextArea(contentTextarea, Object.assign({}, CODEMIRROR_OPTIONS, {
          mode: this.podPath.endsWith('.html') ? 'htmlmixed' : 'markdown',
        }))
        this._codeMirrors['content'].on('change', (cMirror) => {
          this.document.content = cMirror.getValue()
          this.render()
        })
      }
    }

    // Allow selective to run its post render process.
    this.selective.postRender(this.containerEl)

    if (force === true) {
      // Force a reload when neccesary.
      // Test for iframe first, as it may be hidden.
      const iframe = this.containerEl.querySelector('iframe')
      iframe && iframe.contentWindow.location.reload(true)
    }

    // Mark as done rendering.
    this._isRendering = false
    document.dispatchEvent(new CustomEvent('selective.render.complete'))

    // If there were other requests to render, render them.
    if (this._pendingRender) {
      const pendingRender = this._pendingRender
      this._pendingRender = false
      this.render(pendingRender)
    }
  }

  renderEditor(editor, selective) {
    return html`<div class="editor__edit">
      <div class="editor__pod_path">
        <input type="text" value="${editor.podPath}"
          @change=${editor.handlePodPathChange.bind(editor)}
          @input=${editor.handlePodPathInput.bind(editor)}>
        ${editor.document.locales.length > 1 ? html`<i class="material-icons" @click=${editor.handleLocalize.bind(editor)} title="Localize content">translate</i>` : ''}
        <i class="material-icons" @click=${editor.handleFullScreenClick.bind(editor)} title="Fullscreen">${editor.isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</i>
      </div>
      <div class="editor__cards">
        <div class="editor__card editor__field_list">
          <div class="editor__menu">
            <button
                ?disabled=${editor._isSaving || editor.isClean}
                class="editor__save editor__button editor__button--primary ${editor._isSaving ? 'editor__save--saving' : ''}"
                @click=${editor.save.bind(editor)}>
              ${editor.isClean ? 'No changes' : editor._isSaving ? 'Saving...' : 'Save'}
            </button>
            <div class="editor__actions">
              <button class="editor__style__fields editor__button editor__button--secondary ${this.isEditingSource ? '' : 'editor__button--selected'}" @click=${editor.handleFieldsClick.bind(editor)} ?disabled=${!editor.isClean}>Fields</button>
              <button class="editor__style__raw editor__button editor__button--secondary ${this.isEditingSource ? 'editor__button--selected' : ''}" @click=${editor.handleSourceClick.bind(editor)} ?disabled=${!editor.isClean}>Raw</button>
            </div>
          </div>
          ${editor.templateEditorOrSource}
        </div>
        <div class="editor__dev_tools">
          <div>Developer tools:</div>
          <div class="editor__dev_tools__icons">
            <i
                class="editor__dev_tools__icon ${editor.isHightlighted('guess') ? 'editor__dev_tools__icon--selected': ''} material-icons"
                @click=${editor.handleHighlightGuess.bind(editor)}
                title="Highlight auto fields">
              assistant
            </i>
            <i
                class="editor__dev_tools__icon ${editor.isHightlighted('linked') ? 'editor__dev_tools__icon--selected': ''} material-icons"
                @click=${editor.handleHighlightLinked.bind(editor)}
                title="Deep link to fields">
              link
            </i>
            <i
                class="editor__dev_tools__icon ${editor.isHightlighted('dirty') ? 'editor__dev_tools__icon--selected': ''} material-icons"
                @click=${editor.handleHighlightDirty.bind(editor)}
                title="Highlight dirty fields">
              change_history
            </i>
          </div>
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

    // Pull the latest document content before saving.
    this.api.getDocument(this.podPath).then((response) => {
      if (this.isEditingSource) {
        if (response.hash != this.document.hash) {
          this.listeners.trigger('save.error', 'Content has changed remotely.')
          return
        }

        const result = this.api.saveDocumentSource(
          this.podPath, this.document.rawFrontMatter)
        result.then((response) => this.handleSaveResponse(response, isAutosave))
        result.catch((err) => this.handleSaveError(err))
      } else {
        this.updateDocumentFromResponse(response)

        // Updating the selective data keeps any 'dirty' field values.
        // Rendering allows all the original values to be updated.
        this.selective.data = this.document.data
        this.render()

        const newFrontMatter = this.selective.value
        const content = newFrontMatter[CONTENT_KEY]
        delete newFrontMatter[CONTENT_KEY]
        const result = this.api.saveDocumentFields(
          this.podPath, newFrontMatter, this.document.locale, content)
        result.then((response) => this.handleSaveResponse(response, isAutosave))
        result.catch((err) => this.handleSaveError(err))
      }
    })
  }

  scrollToLinkedField() {
    if (!this.linkedFields.length) {
      return
    }

    let searchCount = 0
    const searchForLinkedField = () => {
      document.addEventListener('selective.render.complete', (evt) => {
        const selectedFields = this.containerEl.querySelectorAll('.selective__field--linked')
        if (!selectedFields.length) {
          if (searchCount > 20) {
            // Probably doesn't exist, so stop watching for it.
            return
          }

          // Try again next render.
          searchCount++
          searchForLinkedField()

          return
        }

        selectedFields[0].scrollIntoView({
          behavior: 'smooth',
          // block: 'start', // Does not work correctly with sticky menu.
          block: 'center',
        })
      }, {
        once: true,
      })
    }

    searchForLinkedField()
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

  updateDocumentFromResponse(response) {
    this.document.update(
      response['pod_path'],
      response['front_matter'],
      response['raw_front_matter'],
      response['serving_paths'],
      response['default_locale'],
      response['locales'],
      response['content'],
      response['hash'])
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
