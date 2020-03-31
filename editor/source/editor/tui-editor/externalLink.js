/**
 * Custom extension for external linking.
 */
const ExternalLink = function (editor, preset) {
  const className = 'tui-link'
  const toolbar = editor.getUI().getToolbar()
  const { i18n } = editor
  const EVENT_NAME = 'externalLinkButtonClicked'
  const wwEditor = editor.wwEditor

  // Register Event
  editor.eventManager.addEventType(EVENT_NAME)

  // Add Button to tool bar.
  toolbar.insertItem(16, {
    type: 'button',
    options: {
      name,
      className,
      event: EVENT_NAME,
      tooltip: 'External Link',
    },
  })

  // Create popup.
  const POPUP_CONTENT = `
    <label for="url">${i18n.get('URL')}</label>
    <input type="text" class="te-url-input"/>

    <label for="linkText">${i18n.get('Link text')}</label>
    <input type="text" class="te-link-text-input" />

    <label for="target">
      <input type="checkbox" name="target" class="te-link-target-external"> Open in new window?
    </label>
    <div class="te-button-section">
      <button type="button" class="te-ok-button" style="width: 100px">${i18n.get('OK')}</button>
      <button type="button" class="te-close-button" style="width: 100px">${i18n.get('Cancel')}</button>
    </div>`
  const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})(\/([^\s]*))?$/

  const popupElement = document.createElement('DIV')
  popupElement.innerHTML = POPUP_CONTENT

  const popup = editor.getUI().createPopup({
    header: true,
    title: "Insert Link",
    content: popupElement,
    className: 'te-popup-add-link tui-editor-popup',
    target: editor.getUI().getToolbar().el,
  })
  const inputUrlElement = popup.el.querySelector('.te-url-input')
  const inputTextElement = popup.el.querySelector('.te-link-text-input')
  const inputTargetElement = popup.el.querySelector('.te-link-target-external')

  // Handle okay button
  popup.el.querySelector('.te-ok-button').addEventListener('click', () => {
    wwEditor.editor.focus()
    wwEditor.editor.removeAllFormatting()
    let link = `<a data-external="false" href="${inputUrlElement.value}">${inputTextElement.value}</a>`

    if (inputTargetElement.checked) {
      link = `<a data-external="true" target="_blank" rel="noopener noreferrer" href="${inputUrlElement.value}">${inputTextElement.value}</a>`
    }

    const linkWrap = document.createElement('span')
    linkWrap.innerHTML = link
    wwEditor.editor.replaceSelection('')
    wwEditor.editor.insertElement(linkWrap)
    popup.hide()
  })

  // Hanlde close button
  popup.el.querySelector('.te-close-button').addEventListener('click', () => {
    popup.hide()
  })

  // Handle Event.
  editor.eventManager.listen(EVENT_NAME, () => {
    if (popup.isShow()) {
      popup.hide()
      return
    }

    editor.eventManager.emit('closeAllPopup')
    popup.show()

    // Reset all input fields.
    inputUrlElement.value = ''
    inputTextElement.value = ''

    // Initially populate input fields.
    const selectedText = editor.getSelectedText().trim()
    inputTextElement.value = selectedText

    if (URL_REGEX.exec(selectedText)) {
      inputUrlElement.value = selectedText
    }

    inputUrlElement.focus()
  })

  editor.eventManager.listen('closeAllPopup', () => {
    popup.hide()
  })

  editor.eventManager.listen('removeEditor', () => {
    popup.remove()
  })
}

export default ExternalLink
