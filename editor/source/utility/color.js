/**
 * Color modification utilities.
 */

const HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
const HEX_SHORT_REGEX = /^#?([a-f\d])([a-f\d])([a-f\d])$/i


export default class Color {
  constructor(r, g, b) {
    // Check for hex from constructor.
    if (!g && !b) {
      const rgb = Color.hexToRgb(r)
      r = rgb.r
      g = rgb.g
      b = rgb.b
    }

    this.r = r
    this.g = g
    this.b = b
  }

  static colorValueToHex(c) {
    const hex = c.toString(16)
    return `${hex.length == 1 ? "0" : ""}${hex}`
  }

  static hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    hex = hex.replace(HEX_SHORT_REGEX, (_, r, g, b) => `${r}${r}${g}${g}${b}${b}`)

    const result = HEX_REGEX.exec(hex);
    if (!result) {
      return null
    }

    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
  }

  get luminanace() {
    // Formula: http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef

    const normalized = [this.r, this.g, this.b].map(function (v) {
        v /= 255
        return v <= 0.03928
            ? v / 12.92
            : Math.pow( (v + 0.055) / 1.055, 2.4 )
    })
    return normalized[0] * 0.2126 + normalized[1] * 0.7152 + normalized[2] * 0.0722
  }

  contrast(otherColor) {
    const brightest = Math.max(this.luminanace, otherColor.luminanace)
    const darkest = Math.min(this.luminanace, otherColor.luminanace)
    return (brightest + 0.05) / (darkest + 0.05)
  }

  toInverse() {
    return new this(255 - this.r, 255 - this.g, 255 - this.b)
  }

  toGrayscale() {
    var grayscaleColorValue = (((r * 76) + (g * 150) + (b * 29)) >> 8)
    return new this(
      grayscaleColorValue, grayscaleColorValue, grayscaleColorValue)
  }

  toHex() {
    return `#${Color.colorValueToHex(this.r)}${Color.colorValueToHex(this.g)}${Color.colorValueToHex(this.b)}`
  }
}
