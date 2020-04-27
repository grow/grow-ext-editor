// Adapted from github.com/quilljs/quill/issues/1089#issuecomment-614313509

import base64toBlob from '../../utility/base64'

export default class ImageUploader {
  constructor(uploadFunc) {
    this.uploadFunc = uploadFunc
  }

  uploadBase64(base64Str) {
    if (typeof base64Str !== 'string' || base64Str.length < 100) {
        return base64Str
    }

    // Convert into a blob.
    const block = base64Str.split(";")
    const contentType = block[0].split(":")[1]
    const imageData = block[1].split(",")[1]
    const imageBlob = base64toBlob(imageData, contentType)

    return this.uploadFunc(imageBlob)
  }
}
