import { Storage } from "@plasmohq/storage"

import { generateToken } from "~api/generateToken"
import { getDatabase } from "~api/getDatabase"
import { getToken } from "~api/getToken"
import { saveAnswer } from "~api/saveAnswer"
import { searchNotion } from "~api/search"
import type { StoredDatabase } from "~utils/types"

// API calls that can be made from content scripts transit trough the background script
// This is done to prevent CORS errors
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "search":
      searchNotion(message.body.query).then((res) => {
        sendResponse(res)
      })
      break
    case "saveAnswer":
      saveAnswer(message.body).then((res) => {
        sendResponse(res)
      })
      break
    case "generateToken":
      // using two means of checking if user is logged in just to be sure
      const session = new Storage({
        area: "session",
        secretKeyList: ["token"]
      })
      session.get("token").then((token) => {
        if (token) return
        generateToken(message.body.code).then((res) => {
          sendResponse(res)
        })
      })
      break
    default:
      return true
  }
  return true
})

const authenticate = async () => {
  const session = new Storage({
    area: "session",
    secretKeyList: ["token"]
  })
  const storage = new Storage()
  const _token = await session.get("token")
  console.log("token already exists")
  if (_token) return
  // await session.set("token", null)
  // await storage.set("workspace_id", null)
  // await storage.set("user_id", null)
  const [workspace_id, user_id] = await Promise.all([
    storage.get("workspace_id"),
    storage.get("user_id")
  ])
  if (!workspace_id || !user_id) return
  const token = await getToken({
    workspace_id,
    user_id
  })
  await session.set("token", token)
  console.log("authenticated")
}

const refreshIcons = async () => {
  const storage = new Storage()
  const databases = await storage.get<StoredDatabase[]>("databases")
  for (let i = 0; i < databases.length; i++) {
    const icon = databases[i].icon
    if (!icon) continue
    if (icon.type === "file") {
      const expiryTime = icon.file.expiry_time
      if (new Date(expiryTime).getTime() < Date.now()) {
        console.log("refreshing icon for", databases[i].title)
        const db = await getDatabase(databases[i].id)
        databases[i].icon = db.icon
        await storage.set("databases", databases)
      }
    }
  }
}

authenticate()
refreshIcons()

export default {}
