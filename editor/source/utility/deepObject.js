/**
 * Utility for working with deep object references.
 *
 * Example: obj.get('somthing.sub.key') would deeply reference the object.
 */

export default class DeepObject {
  constructor(obj) {
    this.obj = obj || {}
  }

  get(key) {
    let root = this.obj
    for (const part of key.split('.')) {
      if (!root) {
        return undefined
      }
      if (!part in root) {
        return undefined
      }
      root = root[part]
    }
    return root
  }

  set(key, value) {
    let root = this.obj
    const parts = key.split('.')
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in root)) {
        root[part] = {}
      }
      root = root[part]
    }
    root[parts[parts.length - 1]] = value
  }
}


export const autoDeepObject = (value) => {
  // Allow for duck typing and external objects that define a get.
  const has_get = value.get && typeof value.get === 'function'
  if (has_get || value instanceof DeepObject) {
    return value
  }

  console.log('here', value);

  return new DeepObject(value)
}
