/**
 *  DOM helper functions.
 */

const findParentByClassname = (element, classname) => {
  while(element && !element.classList.contains(classname)) {
    element = element.parentElement
  }
  return element
}

export { findParentByClassname }
