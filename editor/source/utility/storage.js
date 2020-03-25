export default class Storage {
  constructor(isTesting) {
    this.isTesting = isTesting
  }

  clear() {
    if (this.isTesting) {
      return undefined
    }

    return localStorage.clear()
  }

  getItem(...args) {
    if (this.isTesting) {
      return null
    }

    return localStorage.getItem(...args)
  }

  removeItem(...args) {
    if (this.isTesting) {
      return undefined
    }

    return localStorage.removeItem(...args)
  }

  setItem(...args) {
    if (this.isTesting) {
      return undefined
    }

    return localStorage.setItem(...args)
  }
}
