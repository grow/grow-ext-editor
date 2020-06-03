/**
 * Constructor field types for the editor extension.
 */

import {
  html,
  repeat,
  Field,
} from 'selective-edit'
import {
  createWhiteBlackFilter,
  regexList,
} from '../../utility/filter'
import DataType from '../../utility/dataType'
import {
  FileListUI,
} from '../ui/file'
import {
  StringListUI,
} from '../ui/string'

export class ConstructorField extends Field {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'constructor'
    this.tag = '!g.*'
  }

  handleInput(evt) {
    const locale = evt.target.dataset.locale

    // Constructors are represented as objects in json.
    const value = {
      'value': evt.target.value,
      'tag': this.tag,
    }
    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || {}

    return html`
      <input
        id="${this.uid}${locale}"
        placeholder=${this.config.placeholder || ''}
        data-locale=${locale || ''}
        @input=${this.handleInput.bind(this)}
        value=${value.value || ''} />`
  }
}

export class ConstructorFileField extends ConstructorField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this._fileListUi = {}
    this._fileListCls = FileListUI
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      regexList(this.config.get('whitelist')),
      // Blacklist.
      regexList(this.config.get('blacklist')),
    )
  }

  classesFileIcon(value, fileListUi) {
    const classes = [
      'material-icons',
      'selective__field__constructor__file_icon',
    ]

    if (fileListUi.showFileList) {
      classes.push('selective__field__constructor__file_icon--checked')
    }

    return classes.join(' ')
  }

  fileListUiForLocale(locale) {
    const localeKey = this.keyForLocale(locale)
    if (!this._fileListUi[localeKey]) {
      this._fileListUi[localeKey] = new this._fileListCls({
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
    const value = {
      tag: this.tag,
      value: podPath,
    }
    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    const value = this.getValueForLocale(locale) || {}
    const fileListUi = this.fileListUiForLocale(locale)

    return html`
      <div class="selective__field__constructor__input">
        <input
          id="${this.uid}${locale}"
          placeholder=${this.config.placeholder || ''}
          data-locale=${locale || ''}
          @input=${this.handleInput.bind(this)}
          value=${value.value || (DataType.isObject(value) ? '' : value) || ''} />
        <i
            class=${this.classesFileIcon(value, fileListUi)}
            title="Select pod path"
            data-locale=${locale || ''}
            @click=${this.handleFilesToggleClick.bind(this)}>
          list_alt
        </i>
      </div>
      ${this.renderMeta(selective, data, locale, value)}
      ${fileListUi.renderFileList(selective, data, locale)}`
  }

  renderMeta(selective, data, locale, value) {
    return ''
  }
}

export class DocumentField extends ConstructorFileField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'document'
    this.tag = '!g.doc'
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      regexList(this.config.get('whitelist'), [/^\/content\//]),
      // Blacklist.
      regexList(this.config.get('blacklist')),
    )
  }
}

export class StaticField extends ConstructorFileField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'static'
    this.tag = '!g.static'
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      regexList(this.config.get('whitelist'), [
        /^.*\.(png|svg|jpg|jpeg|gif)$/,
        /^\/source\/static\//,
        /^\/static\//,
      ]),
      // Blacklist.
      regexList(this.config.get('blacklist')),
    )
  }
}

export class StringField extends ConstructorFileField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'string'
    this.tag = '!g.string'
    this._fileListUi = {}
    this._fileListCls = StringListUI
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      regexList(this.config.get('whitelist')),
      // Blacklist.
      regexList(this.config.get('blacklist')),
    )
  }

  handleInput(evt) {
    const locale = evt.target.dataset.locale
    const fileListUi = this.fileListUiForLocale(locale)
    const inputValue = evt.target.value

    let value = inputValue

    // Constructors are represented as objects in json.
    // Let it be a normal string if there is not matching string.
    if (fileListUi.isValueValidReference(inputValue)) {
      console.log('inputValue is valid reference.', inputValue);
      value = {
        'value': value,
        'tag': this.tag,
      }
    }

    this.setValueForLocale(locale, value)
  }

  renderInput(selective, data, locale) {
    // Need to load the strings to validate the value.
    // Editor ensures it only loads once.
    selective.editor.loadStrings()

    return super.renderInput(selective, data, locale)
  }

  renderMeta(selective, data, locale, value) {
    // If the value of the field is a string reference show a preview of the
    // string value.
    if (DataType.isObject(value)) {
      const fileListUi = this.fileListUiForLocale(locale)
      const metaValue = fileListUi.valueFromReference(value.value)

      if (metaValue) {
        return html`
          <div
              class="selective__field__constructor__preview">
            <i class="material-icons">input</i>
            <div class="selective__field__constructor__preview__value">
              ${metaValue}
            </div>
          </div>`
      }
    }
    return ''
  }
}

export class YamlField extends ConstructorFileField {
  constructor(config, extendedConfig) {
    super(config, extendedConfig)
    this.fieldType = 'yaml'
    this.tag = '!g.yaml'
    this.filterFunc = createWhiteBlackFilter(
      // Whitelist.
      regexList(this.config.get('whitelist'), [/^\/content\/.*\.yaml$/, /^\/data\/.*\.yaml$/]),
      // Blacklist.
      regexList(this.config.get('blacklist')),
    )
  }
}
