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
import Storage from '../utility/storage'
import {
  SettingSet,
  SettingToggle,
} from '../utility/settings'


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
      <div class="editor__frame">
        ${this.podPath ? editor.renderEditor(editor, selective) : ''}
        ${this.podPath && this.document.servingPath ? editor.renderPreview(editor, selective) : ''}
      </div>
    </div>`
    this.storage = new Storage(this.isTesting)

    const EditorApiCls = this.config.get('EditorApiCls', EditorApi)
    this.api = new EditorApiCls()
    this.listeners = new Listeners()

    this.menu = new Menu({
      testing: this.isTesting,
      enableMenuWorkspace: this.config.enableMenuWorkspace,
    }, this)

    this._podPath = null
    this.podPath = this.containerEl.dataset.defaultPath || this.config.get('defaultPath', '')
    this.repo = null
    this.remote = this.containerEl.dataset.remote || 'origin'
    console.log(this.remote);
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
    this.settingDeviceRotated = new SettingToggle(false, this.storage, 'selective.device.rotated')
    this.settingDeviceView = new SettingToggle(false, this.storage, 'selective.device.view')
    this.settingFullScreenEditor = new SettingToggle(false, this.storage, 'selective.fullScreenEditor')
    this.settingFullScreenPreview = new SettingToggle(false, this.storage, 'selective.fullScreenPreview')
    this.settingHighlightDirty = new SettingToggle(false, this.storage, 'selective.highlight.dirty')
    this.settingHighlightGuess = new SettingToggle(false, this.storage, 'selective.highlight.guess')
    this.settingHighlightLinked = new SettingToggle(false, this.storage, 'selective.highlight.linked')
    this.settingLocalize = new SettingToggle(false, this.storage, 'selective.localize')
    this.settingLocalizeUrls = new SettingToggle(false, this.storage, 'selective.localize.urls')
    this.settingEditorPane = new SettingSet(
      ['fields', 'source', 'history'],
      'fields', this.storage, 'selective.editor.pane')
    this.settingLocale = null

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
    this.selective.localize = this.settingLocalize.on

    // Add the editor extension default field types.
    for (const key of Object.keys(defaultFields)) {
      this.selective.addFieldType(key, defaultFields[key])
    }

    this.bindEvents()
    this.bindKeyboard()

    if (this.podPath && this.podPath.length) {
      this.load(this.podPath)
    } else {
      this.render()
    }

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
    if (!this.document) {
      return true
    }

    return this.document.isClean && this.selective.isClean
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

    // Localize preview pages when a locale is selected.
    if (this.settingLocalize.on && this.settingLocale) {
      const localizedServingPath = this.document.servingPaths[
        this.settingLocale.value]
      if (localizedServingPath) {
        return localizedServingPath
      }
    }
    return this.document.servingPath
  }

  get stylesEditor() {
    const styles = []

    if (this.settingDeviceView.on) {
      styles.push('editor--device')

      // Only allow the rotated when in device view.
      if (this.settingDeviceRotated.on) {
        styles.push('editor--rotated')
      }
    }

    if (this.settingEditorPane.is('fields')) {
      styles.push('editor--fields')
    }

    if (this.settingEditorPane.is('history')) {
      styles.push('editor--history')
    }

    if (this.settingEditorPane.is('source')) {
      styles.push('editor--source')
    }

    if (this.settingFullScreenEditor.on || !this.document.servingPath) {
      styles.push('editor--fullscreen-editor')
    }

    if (this.settingFullScreenPreview.on) {
      styles.push('editor--fullscreen-preview')
    }

    if (this._isFullMarkdownEditor) {
      styles.push('editor--markdown')
    }

    if (this.settingHighlightGuess.on) {
      styles.push('editor--highlight-guess')
    }

    if (this.settingHighlightDirty.on) {
      styles.push('editor--highlight-dirty')
    }

    if (this.settingHighlightLinked.on) {
      styles.push('editor--highlight-linked')
    }

    return styles.join(' ')
  }

  get templatePane() {
    if (this.settingEditorPane.is('source')) {
      const contentHtml = this.document.content != ''
        ? html`
          <div class="editor__source__section">
            <div class="editor__source__title">Content</div>
            <textarea class="editor__source__content" @input=${this.handleRawContent.bind(this)}>${this.document.content}</textarea>
          </div>`
        : ''

      return html`
        <div class="editor__card">
          <div class="editor__card__title">
            Source
          </div>
          <div class="editor__source">
            <div class="editor__source__section">
              <div class="editor__source__title">Front Matter</div>
              <textarea class="editor__source__frontmatter" @input=${this.handleRawInput.bind(this)}>${this.document.rawFrontMatter}</textarea>
            </div>
            ${contentHtml}
          </div>
        </div>`
    }

    if (this.settingEditorPane.is('history')) {
      return html`
        <div class="editor__card">
          <div class="editor__card__title">
            History
          </div>
        </div>`
    }

    return html`
      ${this.renderWorkspace(this, this.selective)}
      <div class="editor__card editor__field_list">
        <div class="editor__card__title">
          Content
        </div>
        <div class="editor__selective">
          ${this.selective.template(this.selective, this.selective.data)}
        </div>
      </div>
      <div class="editor__dev_tools">
        <div>Developer tools:</div>
        <div class="editor__dev_tools__icons">
          <i
              class="editor__dev_tools__icon ${this.settingHighlightGuess.on ? 'editor__dev_tools__icon--selected': ''} material-icons"
              @click=${this.handleHighlightGuess.bind(this)}
              title="Highlight auto fields">
            assistant
          </i>
          <i
              class="editor__dev_tools__icon ${this.settingHighlightLinked.on ? 'editor__dev_tools__icon--selected': ''} material-icons"
              @click=${this.handleHighlightLinked.bind(this)}
              title="Deep link to fields">
            link
          </i>
          <i
              class="editor__dev_tools__icon ${this.settingHighlightDirty.on ? 'editor__dev_tools__icon--selected': ''} material-icons"
              @click=${this.handleHighlightDirty.bind(this)}
              title="Highlight dirty fields">
            change_history
          </i>
        </div>
      </div>`
  }

  set device(value) {
    this._device = value
    this.storage.setItem('selective.device', this._device)
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
      iframeContainerEl, iframeEl, this.settingDeviceView.on, this.settingDeviceRotated.on,
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

    // Allow new workspaces.
    document.addEventListener('selective.workspace.new', (evt) => {
      const base = evt.detail['base']
      const workspace = evt.detail['workspace']
      const remote = (this.config.git || {}).remote || 'origin'
      this.api.createWorkspace(base, workspace, remote).then((result) => {
        console.log(result)
      }).catch((error) => {
        console.error(error)
      })
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

    this.settingLocale = new SettingSet(
      this.document.locales,
      this.document.defaultLocale,
      this.storage,
      'selective.editor.locale')
  }

  handleFieldsClick(evt) {
    this.settingEditorPane.value = 'fields'

    // Need to remove the code mirror for source since it no longer exists.
    delete this._codeMirrors['source']
    delete this._codeMirrors['content']

    // Handle the case that the field information has not been loaded yet.
    if (!this._hasLoadedFields) {
      this.load(this.podPath)
    }

    this.render()
  }

  handleFullScreenEditorClick(evt) {
    this.settingFullScreenEditor.toggle()
    this.render()
  }

  handleFullScreenPreviewClick(evt) {
    this.settingFullScreenPreview.toggle()
    this.render()
  }

  handleHighlightDirty(evt) {
    this.settingHighlightDirty.toggle()
    this.render()
  }

  handleHighlightGuess(evt) {
    this.settingHighlightGuess.toggle()
    this.render()
  }

  handleHighlightLinked(evt) {
    this.settingHighlightLinked.toggle()
    this.render()
  }

  handleLoadFieldsResponse(response) {
    this._hasLoadedFields = true
    this._isFullMarkdownEditor = false
    this.settingEditorPane.value = 'fields'
    this.documentFromResponse(response)
    this.pushState(this.document.podPath)

    // Set the data from the document front matter.
    this.selective.data = this.document.data
    this.selective.config.set('defaultLocale', this.document.defaultLocale)
    this.updateSelectiveLocalization()
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
    this.settingDeviceRotated.toggle()
    this.render()
  }

  handleDeviceSwitchClick(evt) {
    const target = findParentByClassname(evt.target, 'editor__preview__size')
    this.device = target.dataset.device
    this.render()
  }

  handleDeviceToggleClick(evt) {
    this.settingDeviceView.toggle()
    this.render()
  }

  handleHistoryClick(evt) {
    this.settingEditorPane.value = 'history'
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
    this.settingEditorPane.value = 'source'
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
    this.settingLocalize.toggle()
    this.selective.localize = this.settingLocalize.on
    this.render()
  }

  handleLocalizeSelect(evt) {
    this.settingLocalize.value = true
    this.selective.localize = this.settingLocalize.on
    this.settingLocale.value = evt.target.value
    this.updateSelectiveLocalization()
    this.render()
  }

  handleLocalizeUrlsClick(evt) {
    evt.preventDefault()
    this.settingLocalizeUrls.toggle()
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
    // TODO: Add ability to switch while there are unsaved changes.
    // if (!this.settingEditorPane.is('source') && !this.isClean) {
    //   const newFrontMatter = this.selective.value
    //   const content = newFrontMatter[CONTENT_KEY]
    //   delete newFrontMatter[CONTENT_KEY]
    //   this.document.rawFrontMatter = dump(newFrontMatter)
    //   this.document.content = content
    // }

    this.settingEditorPane.value = 'source'
    this.render()
  }

  load(podPath) {
    if (this.settingEditorPane.is('source')) {
      this.loadSource(podPath)
    } else if (this.settingEditorPane.is('history')) {
      // TODO: Load history.
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
    if(this.settingEditorPane.is('source') && !this._codeMirrors['source']) {
      const frontmatterTextarea = this.containerEl.querySelector('.editor__source textarea.editor__source__frontmatter')
      this._codeMirrors['source'] = CodeMirror.fromTextArea(frontmatterTextarea, Object.assign({}, CODEMIRROR_OPTIONS, {
        mode: 'yaml',
      }))
      this._codeMirrors['source'].on('change', (cMirror) => {
        this.document.rawFrontMatter = cMirror.getValue()
        this.render()
      })
    }

    if(this.settingEditorPane.is('source') && !this._codeMirrors['content']) {
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
    if (editor.settingFullScreenPreview.on) {
      return ''
    }

    return html`<div class="editor__edit">
      <div class="editor__edit__header">
        <div class="editor__edit__header__section">
          <div class="editor__edit__header__label">
            Page:
          </div>
          <div class="editor__edit__header__title">
            ${editor.document.data['$title'] || editor.document.data['$title@']}
          </div>
        </div>
        <div class="editor__edit__header__section">
          <div class="editor__edit__header__pod_path">
            ${editor.podPath}
          </div>
          ${this.servingPath ? html`<i class="material-icons" @click=${editor.handleFullScreenEditorClick.bind(editor)} title="Fullscreen">${editor.settingFullScreenEditor.on || !this.servingPath ? 'fullscreen_exit' : 'fullscreen'}</i>` : ''}
        </div>
      </div>
      <div class="editor__cards">
        <div class="editor__card editor__menu">
            <div class="editor__actions">
              <button class="editor__style__fields editor__button editor__button--secondary ${this.settingEditorPane.is('fields') ? '' : 'editor__button--selected'}" @click=${editor.handleFieldsClick.bind(editor)} ?disabled=${!editor.isClean}>Fields</button>
              <button class="editor__style__raw editor__button editor__button--secondary ${this.settingEditorPane.is('source') ? 'editor__button--selected' : ''}" @click=${editor.handleSourceClick.bind(editor)} ?disabled=${!editor.isClean}>Source</button>
              <!-- <button class="editor__style__raw editor__button editor__button--secondary ${this.settingEditorPane.is('history') ? 'editor__button--selected' : ''}" @click=${editor.handleHistoryClick.bind(editor)} ?disabled=${!editor.isClean}>History</button> -->
            </div>
            <button
                ?disabled=${editor._isSaving || editor.isClean}
                class="editor__save editor__button editor__button--primary ${editor._isSaving ? 'editor__save--saving' : ''}"
                @click=${editor.save.bind(editor)}>
              ${editor.isClean ? 'No changes' : editor._isSaving ? 'Saving...' : 'Save'}
            </button>
        </div>
        ${editor.templatePane}
      </div>
    </div>`
  }

  renderPreview(editor, selective) {
    if (this.settingFullScreenEditor.on || !this.servingPath) {
      return ''
    }

    let previewSizes = ''
    if (editor.settingDeviceView.on) {
      previewSizes = html`<div class="editor__preview__sizes">
        ${repeat(Object.entries(this.devices), (device) => device[0], (device, index) => html`
          <div
              class="editor__preview__size ${editor.device == device[0] ? 'editor__preview__size--selected' : ''}"
              data-device="${device[0]}"
              @click=${editor.handleDeviceSwitchClick.bind(editor)}>
            ${device[1].label}
            <span class="editor__preview__size__dimension">
              (${editor._sizeLabel(device[1], editor.settingDeviceRotated.on)})
            </span>
          </div>`)}
      </div>`
    }

    let localize = ''
    if (editor.document.locales.length > 1) {
      const locales = [...editor.document.locales].sort()
      const defaultLocaleIndex = locales.indexOf(this.document.defaultLocale)
      if (defaultLocaleIndex) {
        locales.splice(defaultLocaleIndex, 1)
      }

      localize = html`
        <i class="material-icons" @click=${editor.handleLocalize.bind(editor)} title="Localize content">translate</i>
        <select class="editor__locales" @change=${editor.handleLocalizeSelect.bind(editor)}>
          <option
              data-locale="${this.document.defaultLocale}"
              ?selected=${this.settingLocale.value == this.document.defaultLocale}>
            ${this.document.defaultLocale}
          </option>
          ${repeat(locales, (locale) => locale, (locale, index) => html`
            <option
                data-locale="${locale}"
                ?selected=${this.settingLocale.value == locale}>
              ${locale}
            </option>`)}
        </select>`
    }

    return html`<div class="editor__preview">
      <div class="editor__preview__header">
        <div class="editor__preview__header__icons">
          <i class="material-icons" @click=${editor.handleFullScreenPreviewClick.bind(editor)} title="Fullscreen">${editor.settingFullScreenPreview.on ? 'fullscreen_exit' : 'fullscreen'}</i>
          ${localize}
        </div>
        <div class="editor__preview__header__label">
          Preview
        </div>
        <div class="editor__preview__header__icons">
          ${previewSizes}
          <i class="material-icons" @click=${editor.handleDeviceToggleClick.bind(editor)} title="Toggle device view">devices</i>
          <i class="material-icons editor--device-only" @click=${editor.handleDeviceRotateClick.bind(editor)} title="Rotate device view">screen_rotation</i>
          <i class="material-icons" @click=${editor.handleOpenInNew.bind(editor)} title="Preview in new window">open_in_new</i>
        </div>
      </div>
      <div class="editor__preview__frame">
        <iframe src="${editor.previewUrl}" @load=${editor.handlePreviewIframeNavigation.bind(editor)}></iframe>
      </div>
    </div>`
  }

  renderWorkspace(editor, selective) {
    const locales = Object.keys(editor.document.servingPaths)

    if (!locales.length) {
      return ''
    }

    let urlList = ''
    let moreLocales = ''

    if (locales.length > 1) {
      if (this.settingLocalizeUrls.on) {
        moreLocales = html`
          <a
              class="editor__workspace__url__more"
              @click=${editor.handleLocalizeUrlsClick.bind(this)}
              href="#">
            (show less)
          </a>`
      } else {
        moreLocales = html`
          <a
              class="editor__workspace__url__more"
              @click=${editor.handleLocalizeUrlsClick.bind(this)}
              href="#">
            +${locales.length - 1}
          </a>`
      }
    }

    if (this.settingLocalizeUrls.on) {
      urlList = html`
        ${repeat(Object.entries(editor.document.servingPaths), (path) => path[0], (path, index) => html`
          <div
              class="editor__workspace__url"
              data-locale="${path[0]}">
            <a href="${path[1]}">${path[1]}</a>
            ${this.document.defaultLocale == path[0] ? moreLocales : html`<span class="editor__workspace__locale">${path[0]}</span>`}
          </div>`)}`
    } else {
      const defaultLocale = editor.document.defaultLocale
      const localeUrl = editor.document.servingPaths[defaultLocale]

      urlList = html`
        <div
            class="editor__workspace__url"
            data-locale="${defaultLocale}">
          <a href="${localeUrl}">${localeUrl}</a>
          ${moreLocales}
        </div>`
    }

    return html`
      <div class="editor__card">
        <div class="editor__card__title">
          Workspace
        </div>
        <div class="editor__workspace">
          ${urlList}
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
      editorPane: this.settingEditorPane.value,
    })

    // Pull the latest document content before saving.
    this.api.getDocument(this.podPath).then((response) => {
      if (this.settingEditorPane.is('source')) {
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

  updateSelectiveLocalization() {
    // Determine the locales from the default and selected locale or from document.
    if (this.settingLocale && this.settingLocale.value != this.document.defaultLocale) {
      this.selective.config.set('locales', [this.document.defaultLocale, this.settingLocale.value])
    } else {
      this.selective.config.set('locales', this.document ? this.document.locales : [])
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
