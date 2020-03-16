export default class Storage {
  constructor(isTesting) {
    this.isTesting = isTesting
  }

  clear() {
    if (this.isTesting) {
      return undefined
    }

    return localstorage.clear()
  }

  getItem(...args) {
    if (this.isTesting) {
      return null
    }

    return localstorage.getItem(...args)
  }

  removeItem(...args) {
    if (this.isTesting) {
      return undefined
    }

    return localstorage.removeItem(...args)
  }

  setItem(...args) {
    if (this.isTesting) {
      return undefined
    }

    return localstorage.setItem(...args)
  }
}
