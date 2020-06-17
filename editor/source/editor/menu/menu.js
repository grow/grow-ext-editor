/**
 * Content editor.
 */

import {
  html,
  render,
  repeat,
} from 'selective-edit'
import { findParentByClassname } from '../../utility/dom'
import {
  createWhiteBlackFilter,
} from '../../utility/filter'
import {
  MenuWindow,
} from '../parts/modal'
import MenuBase from './base'
import RepoMenu from './repo'
import SiteMenu from './site'
import TreeMenu from './tree'


export default class Menu extends MenuBase {
  constructor(config, editor) {
    super(config)
    this.editor = editor
    this.menuWindow = new MenuWindow()
    this._repoMenu = new RepoMenu({
      testing: this.isTesting,
    })
    this._siteMenu = new SiteMenu({
      testing: this.isTesting,
    })
    this._treeMenu = new TreeMenu({
      testing: this.isTesting,
    })
    this._state = {
      pod: null,
      podPath: editor.podPath,
      podPaths: null,
      repo: null,
      routes: null,
      templates: null,
    }

    this.filterFunc = this.config.get('filterFunc') || createWhiteBlackFilter(
      [/^\/content\//, /^\/data\//],  // Whitelist.
      [],  // Blacklist.
    )

    this.bindEvents()
  }

  get template() {
    return (editor) => html`<div class="menu">
      ${this.renderMenuBar(editor)}
      ${this.renderMenu(editor)}
    </div>`
  }

  bindEvents() {
    this.editor.listeners.add('podPath', this.handlePodPathChange.bind(this))
    this.editor.listeners.add('load.pod', this.handlePodChange.bind(this))
    this.editor.listeners.add('load.podPaths', this.handleLoadPodPaths.bind(this))
    this.editor.listeners.add('load.repo', this.handleLoadRepo.bind(this))
    this.editor.listeners.add('load.routes', this.handleLoadRoutes.bind(this))
    this.editor.listeners.add('load.templates', this.handleLoadTemplates.bind(this))
  }

  handleLoadPodPaths(response) {
    this._state.podPaths = response.pod_paths.sort().filter(this.filterFunc)
    this.render()
  }

  handleLoadRepo(response) {
    this._state.repo = response.repo
    this.render()
  }

  handleLoadRoutes(response) {
    this._state.routes = response.routes
    this.render()
  }

  handleLoadTemplates(response) {
    this._state.templates = response.templates
    this.render()
  }

  handlePodChange(response) {
    this._state.pod = response.pod
    this.render()
  }

  handlePodPathChange(podPath) {
    this._state.podPath = podPath
  }

  handleToggleMenu(evt) {
    this.menuWindow.toggle()
  }

  renderMenu(editor) {
    // Always show the menu when there is not a pod path.
    const isOpen = this.menuWindow.isOpen || !editor.podPath

    if (isOpen) {
      this.menuWindow.contentRenderFunc = () => {
        return html`
          <div class="menu__contents">
            ${this._siteMenu.template(editor, this._state, {
              toggleMenu: this.handleToggleMenu.bind(this),
            })}
            ${this._treeMenu.template(editor, this._state, {})}
          </div>`
      }
    }

    return this.menuWindow.template
  }

  renderMenuBar(editor) {
    if (!this._state.pod) {
      editor.loadPod()
    }

    return html`
      <div class="menu__bar">
        <div class="menu__bar__section">
          <div
              class="menu__hamburger"
              @click=${this.handleToggleMenu.bind(this)}
              title="Open menu">
            <i class="material-icons">menu</i>
          </div>
          <div class="menu__bar__title">
            ${this._state.pod ? this._state.pod.title : ''}
          </div>
        </div>
        <div class="menu__bar__section">
          ${this._repoMenu.template(editor, this._state, {})}
        </div>
      </div>`
  }
}
