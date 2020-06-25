const shared = require('./shared')
const { percySnapshot } = require('@percy/puppeteer')

async function dragAndDrop(page, originSelector, destinationSelector, snapshotName) {
  await page.waitFor(originSelector)
  await page.waitFor(destinationSelector)
  const origin = await page.$(originSelector)
  const destination = await page.$(destinationSelector)
  const ob = await origin.boundingBox()
  const db = await destination.boundingBox()

  // console.log(`Dragging from ${ob.x + ob.width / 2}, ${ob.y + ob.height / 2}`)
  await page.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2)
  await page.mouse.down()

  if (snapshotName) {
    await percySnapshot(page, snapshotName, shared.snapshotOptions)
  }

  // console.log(`Dropping at   ${db.x + db.width / 2}, ${db.y + db.height / 2}`)
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2)
  await page.mouse.up()
}

async function dragAndDrop2(page, originSelector, destinationSelector, snapshotName) {
  await page.waitFor(originSelector)
  await page.waitFor(destinationSelector)

  await page.evaluate((originSelector, destinationSelector) => {
      source = document.querySelector(originSelector)

      event = document.createEvent("CustomEvent")
      event.initCustomEvent("mousedown", true, true, null)
      event.clientX = source.getBoundingClientRect().top
      event.clientY = source.getBoundingClientRect().left
      source.dispatchEvent(event)

      event = document.createEvent("CustomEvent")
      event.initCustomEvent("dragstart", true, true, null)
      event.clientX = source.getBoundingClientRect().top
      event.clientY = source.getBoundingClientRect().left
      source.dispatchEvent(event)

      event = document.createEvent("CustomEvent")
      event.initCustomEvent("drag", true, true, null)
      event.clientX = source.getBoundingClientRect().top
      event.clientY = source.getBoundingClientRect().left
      source.dispatchEvent(event)

      target = document.querySelector(destinationSelector)

      event = document.createEvent("CustomEvent")
      event.initCustomEvent("dragover", true, true, null)
      event.clientX = target.getBoundingClientRect().top
      event.clientY = target.getBoundingClientRect().left
      target.dispatchEvent(event)

      event = document.createEvent("CustomEvent")
      event.initCustomEvent("drop", true, true, null)
      event.clientX = target.getBoundingClientRect().top
      event.clientY = target.getBoundingClientRect().left
      target.dispatchEvent(event)

      event = document.createEvent("CustomEvent")
      event.initCustomEvent("dragend", true, true, null)
      event.clientX = target.getBoundingClientRect().top
      event.clientY = target.getBoundingClientRect().left
      target.dispatchEvent(event)
    }, originSelector, destinationSelector)
}

// https://github.com/puppeteer/puppeteer/issues/1366#issuecomment-589828387
// https://gist.github.com/wardnath/0aa9f293ee964c3a2bc149d9e924822e
async function dragAndDrop3(page, originSelector, destinationSelector, snapshotName) {
  const sourceElement = await page.waitFor(originSelector)
  const destinationElement = await page.waitFor(destinationSelector)
  const sourceBox = await sourceElement.boundingBox();
  const destinationBox = await destinationElement.boundingBox();

  await page.evaluate(
    async (originSelector, destinationSelector, sourceBox, destinationBox) => {
      const source = document.querySelector(originSelector)
      const destination = document.querySelector(destinationSelector)

      const sourceX = sourceBox.x + sourceBox.width / 2
      const sourceY = sourceBox.y + sourceBox.height / 2
      const destinationX = destinationBox.x + destinationBox.width / 2
      const destinationY = destinationBox.y + destinationBox.height / 2

      const waitTime = 2000
      const sleep = (milliseconds) => {
        return new Promise(resolve => setTimeout(resolve, milliseconds))
      }

      const dataTransfer = new DataTransfer()
      dataTransfer.effectAllowed = 'all'
      dataTransfer.dropEffect = 'move'
      dataTransfer.files = []

      source.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          screenX: sourceX,
          screenY: sourceY,
          clientX: sourceX,
          clientY: sourceY
        })
      )
      await sleep(waitTime)
      source.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          screenX: sourceX,
          screenY: sourceY,
          clientX: sourceX,
          clientY: sourceY
        })
      )
      await sleep(waitTime)

      source.dispatchEvent(
        new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          screenX: sourceX,
          screenY: sourceY,
          clientX: sourceX,
          clientY: sourceY,
          dataTransfer,
        })
      )

      await sleep(waitTime)
      destination.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          screenX: destinationX,
          screenY: destinationY,
          clientX: destinationX,
          clientY: destinationY,
        })
      )

      await sleep(waitTime)
      destination.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          screenX: destinationX,
          screenY: destinationY,
          clientX: destinationX,
          clientY: destinationY,
        })
      )

      await sleep(waitTime)
      destination.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          screenX: destinationX,
          screenY: destinationY,
          clientX: destinationX,
          clientY: destinationY,
          dataTransfer,
        })
      )

      await sleep(waitTime)
      destination.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          screenX: destinationX,
          screenY: destinationY,
          clientX: destinationX,
          clientY: destinationY,
          dataTransfer,
        })
      )

      await sleep(waitTime)
      source.dispatchEvent(
        new DragEvent('dragend', {
          bubbles: true,
          cancelable: true,
          screenX: destinationX,
          screenY: destinationY,
          clientX: destinationX,
          clientY: destinationY,
        })
      )
    }, originSelector, destinationSelector, sourceBox, destinationBox)
}

module.exports = {
  dragAndDrop: dragAndDrop,
  dragAndDrop2: dragAndDrop2,
  dragAndDrop3: dragAndDrop3,
}
