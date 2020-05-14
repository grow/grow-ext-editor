/**
 * Folder like structure for displaying paths.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import generateUUID from '../../utility/uuid'


const PROTECTED_FROM_COPY_PATHS = [
  '/podspec.yaml',
]


const PROTECTED_FROM_DELETE_PATHS = [
  '/podspec.yaml',
]


const hasTemplate = (templates, folder) => {
  const collections = Object.keys(templates)
  return collections.includes(folder)
}


const isProtectedFromCopy = (podPath) => {
  // TODO: Expand to let the config also define protected files.
  return PROTECTED_FROM_COPY_PATHS.includes(podPath)
}


const isProtectedFromDelete = (podPath) => {
  // TODO: Expand to let the config also define protected files.
  return PROTECTED_FROM_DELETE_PATHS.includes(podPath)
}


export default class FolderStructure {
  constructor(paths, templates, folder, folderBase) {
    this.uid = generateUUID()
    this.templates = templates
    this.folderInfo = {
      folder: folder || '/',
      folderBase: folderBase,
      folders: [],
      files: [],
    }

    let prefix = this.folderInfo.folder

    // Make sure the prefix ends with a /.
    if (!prefix.endsWith('/')) {
      prefix += '/'
    }

    const subFolders = []

    for (const path of paths) {
      if (path.startsWith(prefix)) {
        const subPath = path.slice(prefix.length)
        const subPathParts = subPath.split('/')
        if (subPathParts.length > 1) {
          const subFolder = subPathParts[0]
          if (subFolders.includes(subFolder)) {
            continue
          }

          subFolders.push(subFolder)
          this.folderInfo.folders.push(
            new FolderStructure(paths, this.templates, `${prefix}${subFolder}`, subFolder))
        } else {
          const fileName = subPathParts[0]
          let fileExt = ''
          if (fileName.includes('.')) {
            fileExt = fileName.split('.').pop()
          }
          let fileBase = fileName
          if (fileExt) {
            fileBase = fileName.slice(0, fileName.length - fileExt.length - 1)
          }
          this.folderInfo.files.push({
            fileName: fileName,
            fileBase: fileBase,
            fileExt: fileExt,
          })
        }
      }
    }
  }

  render(path, expandedFolders, eventHandlers, threshold, lookupFunc) {
    threshold = threshold || 0
    const folder = this.folderInfo.folder
    const level = folder == '/' ? 0 : folder.split('/').length - 1
    const classes = ['menu__tree__folder']
    const isExpanded = level <= threshold || expandedFolders.includes(folder)
    const filePrefix = `${folder == '/' ? '' : folder}/`

    if (!isExpanded) {
      classes.push('menu__tree__folder--collapsed')
    }

    return html`<div class=${classes.join(' ')}>
      ${level > threshold
        ? html`
          <div class="menu__tree__folder__directory icons" data-folder=${folder} @click=${eventHandlers.handleFolderToggle}>
            <i class="material-icons">${isExpanded ? 'expand_more' : 'expand_less'}</i>
            <div class="menu__tree__folder__directory__label">
              ${this.folderInfo.folderBase}
            </div>
          </div>`
        : ''}
      <div class=${level > threshold ? 'menu__tree__folder__level' : ''}>
        <div class=${level > threshold ? 'menu__tree__folder__folder' : ''}>
          ${repeat(this.folderInfo.folders, (folder) => folder.uid, (folder, index) => html`
            ${folder.render(path, expandedFolders, eventHandlers, threshold, lookupFunc)}`)}
        </div>
        <div class=${level > threshold ? 'menu__tree__folder__files' : ''}>
          ${level > threshold ? html`
            <div data-folder=${folder} class="menu__tree__folder__actions">
              <button class="editor__button editor__actions__add" @click=${eventHandlers.handleFileNewClick}>New file</button>
            </div>` : ''}
          ${repeat(this.folderInfo.files, (file) => `${filePrefix}${file.fileName}`, (file, index) => {
            const podPath = lookupFunc ? lookupFunc(`${filePrefix}${file.fileName}`) : `${filePrefix}${file.fileName}`

            return html`
              <div
                  class="menu__tree__folder__file ${
                    path == `${filePrefix}${file.fileName}` || path == `${filePrefix}${file.fileName}/`
                    ? 'menu__tree__folder__file--selected'
                    : ''} icons"
                  data-pod-path=${podPath}
                  @click=${eventHandlers.handleFileClick}>
                <i class="material-icons">notes</i>
                <div class="menu__tree__folder__file__label">
                  ${file.fileBase || '/'}
                </div>
                ${isProtectedFromCopy(podPath)
                  ? ''
                  : html`<i
                      class="material-icons icon icon--hover-only"
                      title="Copy file"
                      @click=${eventHandlers.handleFileCopyClick}>
                    file_copy
                  </i>`}
                ${isProtectedFromDelete(podPath)
                  ? ''
                  : html`<i
                      class="material-icons icon icon--hover-only"
                      title="Delete file"
                      @click=${eventHandlers.handleFileDeleteClick}>
                    delete
                  </i>`}
              </div>`
          })}
        </div>
      </div>
    </div>`
  }
}
