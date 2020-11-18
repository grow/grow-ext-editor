import DataType from './dataType'

// Creates a filter that uses a included and excluded of regex to filter.
export const createIncludeExcludeFilter = (included, excluded) => {
  included = included || []
  excluded = excluded || []

  return (value) => {
    // Test against the included.
    if (included.length) {
      let meetsIncluded = false
      for (const exp of included) {
        if (value.match(exp)) {
          meetsIncluded = true
          break
        }
      }

      if (!meetsIncluded) {
        return false
      }
    }

    // Test against the excluded.
    for (const exp of excluded) {
      if (value.match(exp)) {
        return false
      }
    }

    return true
  }
}

// Creates a filter that uses a value to filter.
export const createValueFilter = (filterValue) => {
  const regex = RegExp(filterValue, 'i')

  return (value) => {
    return value.match(regex)
  }
}

export const filterObject = (obj, filterFunc, includeKeys, keyParts) => {
  includeKeys = includeKeys || false
  keyParts = keyParts || []

  if (!DataType.isObject(obj)) {
    // Use the filter function to determine if the value should be part of the
    // filtered object.
    // Currently only written to work with objects with string leaf nodes.
    if (filterFunc(obj)) {
      return obj
    }
    return null
  }

  const newObj = {}
  const keys = Object.keys(obj)

  for (const key of keys) {
    const newKeyParts = keyParts.concat([key])
    const fullKey = newKeyParts.join('.')

    // Keep the entire value of the matching key if testing keys and matches.
    if (includeKeys && filterFunc(fullKey)) {
      newObj[key] = obj[key]
    } else {
      const subValue = filterObject(obj[key], filterFunc, includeKeys, newKeyParts)

      // Only add it in to the new object if some of the sub object matches.
      if (subValue) {
        newObj[key] = subValue
      }
    }
  }

  // Do not return if empty.
  if (!Object.keys(newObj).length) {
    return null
  }

  return newObj
}

export const regexList = (rawList, defaults) => {
  const list = []
  rawList = rawList || []

  for (const value of rawList) {
    list.push(new RegExp(value, 'gi'))
  }

  if (!list.length) {
    return defaults || []
  }

  return list
}
