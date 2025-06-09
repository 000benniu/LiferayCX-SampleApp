const express = require("express")
var dotenv = require("dotenv")
var dotenvExpand = require("dotenv-expand")

var myEnv = dotenv.config()
dotenvExpand.expand(myEnv)

const app = express()
const port = process.env.PORT || 8090

// ミドルウェアの設定
app.use(express.json())
app.use(express.static("public"))

// デバッグ用ミドルウェア
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// 静的ファイルの提供
app.use(express.static("public"))

// user_listルートを設定
const user_list = require("./lib/user-list")
app.use("/api", user_list)
console.log("APIルートが /api にマウントされました")

// メインページのルート
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname })
})

// user-listページのルート（後方互換性のため）
app.get("/user-list", (req, res) => {
  res.sendFile("index.html", { root: __dirname })
})

// 404エラーハンドリング
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`)
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

app.listen(port, () => {
  console.log(`User Management server is listening on port ${port}`)
  console.log(`Available routes:`)
  console.log(`  GET  / - Main page`)
  console.log(`  GET  /user-list - User list page`)
  console.log(`  POST /api/user-list - User list API`)
})
