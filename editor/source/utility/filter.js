// Creates a filter that uses a whitelist and blacklist of regex to filter.
export const createWhiteBlackFilter = (whitelist, blacklist) => {
  whitelist = whitelist || []
  blacklist = blacklist || []

  return (value) => {
    // Test against the whitelist.
    let meetsWhitelist = false
    for (const exp of whitelist) {
      if (exp.test(value)) {
        meetsWhitelist = true
        break
      }
    }

    if (!meetsWhitelist) {
      return false
    }

    // Test against the blacklist.
    for (const exp of blacklist) {
      if (exp.test(value)) {
        return false
      }
    }

    return true
  }
}

// Creates a filter that uses a value to filter.
export const createValueFilter = (filterValue) => {
  return (value) => {
    return value.includes(filterValue)
  }
}
