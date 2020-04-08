/**
 * Utility for determining the type of a data value.
 */

export default class DataType {
  static isArray (value) {
    if (Array.isArray) {
      return Array.isArray(value)
    }
    return value && typeof value === 'object' && value.constructor === Array
  }

  static isBoolean (value) {
    return typeof value === 'boolean'
  }

  static isDate (value) {
    return value instanceof Date
  }

  static isFunction (value) {
    return typeof value === 'function'
  }

  static isNumber (value) {
    return typeof value === 'number' && isFinite(value)
  }

  static isNull (value) {
    return value === null
  }

  static isObject (value) {
    return value && typeof value === 'object' && value.constructor === Object
  }

  static isRegExp (value) {
    return value && typeof value === 'object' && value.constructor === RegExp
  }

  static isString (value) {
    return typeof value === 'string' || value instanceof String
  }

  static isSymbol (value) {
    return typeof value === 'symbol'
  }

  static isUndefined (value) {
    return typeof value === 'undefined'
  }
}
