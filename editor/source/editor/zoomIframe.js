export const zoomIframe = (containerEl, iframeEl, isDeviceView, isRotated, device, containedClass) => {
  if (!iframeEl) {
    return
  }

  // Reset styling to grab correct container bounds.
  iframeEl.style.height = '100px'
  iframeEl.style.transform = `scale(1)`
  iframeEl.style.width = '100px'
  containerEl.style.maxHeight = 'auto'
  containerEl.style.maxWidth = 'auto'
  containerEl.classList.remove(containedClass)

  // Adjustments to apply to the iframeEl.
  let adjustHeight = 'auto'
  let adjustMaxHeight = 'auto'
  let adjustScale = 1
  let adjustWidth = 'auto'

  if (isDeviceView) {
    const containerHeight = containerEl.offsetHeight
    const containerWidth = containerEl.offsetWidth
    let deviceHeight = device['height']
    let deviceWidth = device['width']

    if (deviceWidth && deviceHeight) {
      containerEl.classList.add(containedClass)

      // Adjust for rotated device.
      deviceHeight = isRotated ? deviceWidth : deviceHeight
      deviceWidth = isRotated ? deviceHeight : deviceWidth

      // Constant ratio.
      const fitsWidth = deviceWidth <= containerWidth
      const fitsHeight = deviceHeight <= containerHeight
      if (fitsWidth && fitsHeight) {
        // No need to do scaling, just adjust the size of the iframe.
        adjustWidth = deviceWidth
        adjustHeight = deviceHeight
      } else if (fitsWidth) {
        // Height does not fit. Scale down.
        adjustHeight = deviceHeight
        adjustMaxHeight = deviceHeight
        adjustWidth = deviceWidth * (deviceHeight / containerHeight)
        adjustScale = containerHeight / deviceHeight
      } else {
        // Width does not fit. Scale down.
        adjustHeight = deviceHeight * (deviceWidth / containerWidth)
        adjustMaxHeight = deviceHeight * (deviceWidth / containerWidth)
        adjustWidth = deviceWidth
        adjustScale = containerWidth / deviceWidth
      }
    } else if (deviceWidth) {
      // Scale width and auto adjust height.
      const fitsWidth = deviceWidth <= containerWidth
      if (fitsWidth) {
        containerEl.classList.add(containedClass)
        adjustWidth = deviceWidth
      } else {
        adjustHeight = containerHeight * (deviceWidth / containerWidth)
        adjustMaxHeight = containerHeight * (deviceWidth / containerWidth)
        adjustWidth = deviceWidth
        adjustScale = containerWidth / deviceWidth
      }
    } else {
      // Scale height and auto adjust width.
      const fitsHeight = deviceHeight <= containerHeight
      if (fitsHeight) {
        adjustHeight = deviceHeight
      } else {
        adjustHeight = deviceHeight
        adjustMaxHeight = containerWidth * (deviceHeight / containerHeight)
        adjustWidth = containerWidth * (deviceHeight / containerHeight)
        adjustScale = containerHeight / deviceHeight
      }
    }

    // Make sure that the framing container does not expand.
    // containerEl.style.maxHeight = `${containerHeight}px`
    containerEl.style.maxWidth = `${containerWidth}px`
  } else {
    adjustWidth = 'auto'
    adjustHeight = 'auto'
  }

  iframeEl.style.height = adjustHeight == 'auto' ? 'auto' : `${adjustHeight}px`
  iframeEl.style.maxHeight = adjustHeight == 'auto' ? 'auto' : `${adjustHeight}px`
  iframeEl.style.transform = `scale(${adjustScale})`
  iframeEl.style.width = adjustWidth == 'auto' ? 'auto' : `${adjustWidth}px`
}
