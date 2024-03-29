/**
 * Utility for managing settings easily.
 *
 * Includes support for persistent storage.
 */

class SettingBase {
  constructor(defaultValue, storage, storageKey) {
    this.defaultValue = defaultValue
    this.storage = storage
    this.storageKey = storageKey
    this._value = null

    if (this.storage && this.storageKey) {
      this.value = this.retrieve()
    } else {
      this.value = this.defaultValue
    }
  }

  get value() {
    return this._value
  }

  set value(value) {
    this._value = value

    if (this.storage && this.storageKey) {
      this.storage.setItem(this.storageKey, this._value)
    }
  }

  retrieve() {
    const storageValue = this.storage.getItem(this.storageKey)
    if (typeof storageValue == 'undefined' || storageValue == null) {
      return this.defaultValue
    }
    return storageValue
  }
}

export class SettingSet extends SettingBase {
  constructor(validValues, defaultValue, storage, storageKey) {
    super(defaultValue, storage, storageKey)
    this.validValues = validValues
  }

  get value() {
    return super.value
  }

  set value(value) {
    if(!this.validValues || this.validValues.includes(value)) {
      super.value = value
    } else {
      super.value = this.defaultValue
    }
  }

  is(value) {
    return this.value == value
  }
}

export class SettingToggle extends SettingBase {
  get off() {
    return this._value != true
  }

  get on() {
    return this._value == true
  }

  get value() {
    return super.value
  }

  set value(value) {
    super.value = Boolean(value)
  }

  retrieve() {
    return this.storage.getItem(this.storageKey) == 'true'
  }

  toggle() {
    this.value = !this._value
  }
}
