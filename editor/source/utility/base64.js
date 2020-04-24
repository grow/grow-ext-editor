export default function base64toBlob(base64Data, contentType, sliceSize) {
   contentType = contentType || ''
   sliceSize = sliceSize || 512

   var byteCharacters = atob(base64Data)
   var byteArrays = []

   for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
       const slice = byteCharacters.slice(offset, offset + sliceSize)
       const byteNumbers = new Array(slice.length)
       for (var i = 0; i < slice.length; i++) {
           byteNumbers[i] = slice.charCodeAt(i)
       }
       const byteArray = new Uint8Array(byteNumbers)

       byteArrays.push(byteArray)
   }

   return new Blob(byteArrays, {type: contentType})
}
