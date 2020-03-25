/**
 *  DOM helper functions.
 */

export const findParentByClassname = (element, classname) => {
  while(element && !element.classList.contains(classname)) {
    element = element.parentElement
  }
  return element
}

export const inputFocusAtEnd = (elementId) => {
  const inputEl = document.getElementById(elementId)

  if (!inputEl) {
    return
  }

  inputEl.focus()

  // Focus at the end to keep typing.
  inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length
}

export const inputFocusAtPosition = (elementId, position) => {
  const inputEl = document.getElementById(elementId)

  if (!inputEl) {
    return
  }

  inputEl.focus()

  // Focus at the end to keep typing.
  inputEl.selectionStart = inputEl.selectionEnd = position
}
