const express = require("express")
const request = require("request")
const path = require("path")

const router = express.Router()
const rootPath = path.join(__dirname, "../", "../")

// デバッグ用ミドルウェア
router.use((req, res, next) => {
  console.log(`[user-list] ${req.method} ${req.path}`)
  next()
})

// OAuth2トークン取得エンドポイント
router.post("/oauth2-token", (req, res) => {
  console.log(`[${new Date().toISOString()}] OAuth2トークン取得開始`)
  console.log("リクエストボディ:", req.body)

  const { clientId, clientSecret, tokenUrl, grantType = "client_credentials", scope } = req.body

  // 入力の検証
  if (!clientId || !clientSecret || !tokenUrl) {
    console.log("入力検証エラー: 必須フィールドが不足")
    return res.status(400).json({
      error: "必須フィールドが不足しています：Client ID、Client Secret、Token URLが必要です",
    })
  }

  // OAuth2トークンリクエストのパラメータ
  const tokenRequestData = {
    grant_type: grantType,
    client_id: clientId,
    client_secret: clientSecret,
  }

  // スコープが指定されている場合は追加
  if (scope) {
    tokenRequestData.scope = scope
  }

  const requestOptions = {
    method: "POST",
    url: tokenUrl,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "User-Management-System-OAuth2/1.0",
    },
    form: tokenRequestData,
    timeout: 30000,
  }

  console.log(`[${new Date().toISOString()}] OAuth2トークンを取得中: ${tokenUrl}`)
  console.log("リクエストパラメータ:", tokenRequestData)

  request(requestOptions, (err, httpResponse, body) => {
    if (err) {
      console.error("OAuth2トークン取得エラー:", err)
      return res.status(500).json({
        error: "OAuth2トークンサーバーへの接続に失敗しました",
        details: err.message,
      })
    }

    console.log(`OAuth2レスポンスステータス: ${httpResponse.statusCode}`)
    console.log(`OAuth2レスポンスボディ:`, body)

    if (httpResponse.statusCode !== 200) {
      console.error(`OAuth2トークン取得が失敗しました: ${httpResponse.statusCode}`)

      let errorMessage = `OAuth2トークン取得に失敗しました（ステータス: ${httpResponse.statusCode}）`

      try {
        const errorBody = JSON.parse(body)
        if (errorBody.error_description) {
          errorMessage += `: ${errorBody.error_description}`
        } else if (errorBody.error) {
          errorMessage += `: ${errorBody.error}`
        }
      } catch (parseError) {
        if (body) {
          errorMessage += `: ${body.substring(0, 200)}`
        }
      }

      return res.status(httpResponse.statusCode).json({
        error: errorMessage,
        statusCode: httpResponse.statusCode,
      })
    }

    try {
      const tokenData = JSON.parse(body)

      if (!tokenData.access_token) {
        throw new Error("アクセストークンがレスポンスに含まれていません")
      }

      console.log(`[${new Date().toISOString()}] OAuth2トークンを正常に取得しました`)

      res.json({
        success: true,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || "Bearer",
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        message: "OAuth2トークンを正常に取得しました",
      })
    } catch (parseError) {
      console.error("OAuth2トークンレスポンスの解析に失敗しました:", parseError)
      res.status(500).json({
        error: "OAuth2トークンレスポンスの解析に失敗しました",
        details: parseError.message,
        responseBody: body ? body.substring(0, 500) : "empty",
      })
    }
  })
})

// OAuth2対応ユーザーリストAPI
router.post("/oauth2-user-list", (req, res) => {
  console.log(`[${new Date().toISOString()}] OAuth2 API呼び出し開始`)
  console.log("リクエストボディ:", req.body)

  const { accessToken, apiUrl } = req.body

  // 入力の検証
  if (!accessToken || !apiUrl) {
    console.log("入力検証エラー: 必須フィールドが不足")
    return res.status(400).json({
      error: "必須フィールドが不足しています：Access Token、APIURLが必要です",
    })
  }

  const requestOptions = {
    method: "GET",
    url: apiUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "User-Management-System-OAuth2/1.0",
    },
    timeout: 30000,
    followRedirect: true,
    maxRedirects: 5,
  }

  console.log(`[${new Date().toISOString()}] OAuth2でユーザー情報を取得中: ${apiUrl}`)
  console.log("リクエストオプション:", JSON.stringify(requestOptions, null, 2))

  request(requestOptions, (err, httpResponse, body) => {
    if (err) {
      console.error("OAuth2 APIリクエストエラー:", err)
      return res.status(500).json({
        error: "APIサーバーへの接続に失敗しました",
        details: err.message,
      })
    }

    console.log(`OAuth2 APIレスポンスステータス: ${httpResponse.statusCode}`)
    console.log(`OAuth2 APIレスポンスヘッダー:`, httpResponse.headers)
    console.log(`OAuth2 APIレスポンスボディ（最初の500文字）:`, body ? body.substring(0, 500) : "empty")

    if (httpResponse.statusCode === 401) {
      return res.status(401).json({
        error: "OAuth2トークンが無効または期限切れです。新しいトークンを取得してください。",
        statusCode: 401,
        details: "401 Unauthorized - トークンを再取得してください",
      })
    }

    if (httpResponse.statusCode === 403) {
      return res.status(403).json({
        error: "OAuth2トークンに必要なスコープが不足しています。",
        statusCode: 403,
        details: "403 Forbidden - 適切なスコープでトークンを取得してください",
        suggestion: "Liferay.Headless.Admin.User.everything などの適切なスコープを設定してください",
      })
    }

    if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
      console.error(`OAuth2 APIがステータス ${httpResponse.statusCode} を返しました:`, body)

      let errorMessage = `OAuth2 APIリクエストが失敗しました（ステータス: ${httpResponse.statusCode}）`

      try {
        const errorBody = JSON.parse(body)
        if (errorBody.error || errorBody.message) {
          errorMessage += `: ${errorBody.error || errorBody.message}`
        }
      } catch (parseError) {
        if (body) {
          errorMessage += `: ${body.substring(0, 200)}`
        }
      }

      return res.status(httpResponse.statusCode).json({
        error: errorMessage,
        statusCode: httpResponse.statusCode,
      })
    }

    try {
      const responseData = JSON.parse(body)

      // Liferay APIレスポンス構造の処理
      let users = []

      if (responseData.items && Array.isArray(responseData.items)) {
        users = responseData.items
      } else if (Array.isArray(responseData)) {
        users = responseData
      } else {
        console.warn("予期しないレスポンス構造:", responseData)
        users = []
      }

      console.log(`[${new Date().toISOString()}] OAuth2で${users.length}人のユーザーを正常に取得しました`)

      // Liferay API用のテーブル構造に合わせてユーザーを変換
      const transformedUsers = users.map((user) => {
        // カスタムフィールドから会社名を抽出
        let companyName = ""
        if (user.customFields && Array.isArray(user.customFields)) {
          const companyField = user.customFields.find((field) => field.name === "CompanyName")
          if (companyField && companyField.customValue && companyField.customValue.data) {
            companyName = companyField.customValue.data
          }
        }

        // カスタムフィールドから場所を抽出
        let location = ""
        if (user.customFields && Array.isArray(user.customFields)) {
          const locationField = user.customFields.find((field) => field.name === "Location")
          if (locationField && locationField.customValue && locationField.customValue.data) {
            location = locationField.customValue.data
          }
        }

        // 主要な役割名を取得
        let roleNames = ""
        if (user.roleBriefs && Array.isArray(user.roleBriefs)) {
          roleNames = user.roleBriefs.map((role) => role.name).join(", ")
        }

        return {
          id: user.id || "N/A",
          alternateName: user.alternateName || user.givenName || user.name || "N/A",
          givenName: user.givenName || "",
          familyName: user.familyName || "",
          emailAddress: user.emailAddress || "N/A",
          languageId: user.languageId || user.languageDisplayName || "N/A",
          profileURL: user.profileURL || "",
          dateCreated: user.dateCreated || "",
          jobTitle: user.jobTitle || "",
          companyName: companyName,
          location: location,
          roleNames: roleNames,
          status: user.status || "N/A",
          lastLoginDate: user.lastLoginDate || "",
          hasLoginDate: user.hasLoginDate || false,
        }
      })

      res.json({
        success: true,
        users: transformedUsers,
        total: transformedUsers.length,
        totalCount: responseData.totalCount || transformedUsers.length,
        page: responseData.page || 1,
        pageSize: responseData.pageSize || transformedUsers.length,
        authMethod: "OAuth2",
      })
    } catch (parseError) {
      console.error("OAuth2 APIレスポンスの解析に失敗しました:", parseError)
      console.error("レスポンスボディ:", body)
      res.status(500).json({
        error: "OAuth2 APIレスポンスの解析に失敗しました",
        details: parseError.message,
        responseBody: body ? body.substring(0, 500) : "empty",
      })
    }
  })
})

// Basic認証対応ユーザーリストAPI（既存）
router.post("/user-list", (req, res) => {
  console.log(`[${new Date().toISOString()}] Basic認証 API呼び出し開始`)
  console.log("リクエストボディ:", req.body)

  const { username, password, apiUrl } = req.body

  // 入力の検証
  if (!username || !password || !apiUrl) {
    console.log("入力検証エラー: 必須フィールドが不足")
    return res.status(400).json({
      error: "必須フィールドが不足しています：ユーザー名、パスワード、APIURLが必要です",
    })
  }

  // Basic認証文字列を作成（提供されたサンプルコードの形式に従う）
  const userauthStr = "Basic " + Buffer.from(`${username}:${password}`).toString("base64")

  console.log(`認証情報: ユーザー名=${username}, パスワード長=${password.length}`)
  console.log(`認証ヘッダー: ${userauthStr}`)

  const requestOptions = {
    method: "GET",
    url: apiUrl,
    headers: {
      Authorization: userauthStr,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "User-Management-System/1.0",
    },
    timeout: 30000, // 30秒タイムアウト
    followRedirect: true,
    maxRedirects: 5,
  }

  console.log(`[${new Date().toISOString()}] ユーザー情報を取得中: ${apiUrl}`)
  console.log("リクエストオプション:", JSON.stringify(requestOptions, null, 2))

  request(requestOptions, (err, httpResponse, body) => {
    if (err) {
      console.error("リクエストエラー:", err)
      return res.status(500).json({
        error: "APIサーバーへの接続に失敗しました",
        details: err.message,
      })
    }

    console.log(`レスポンスステータス: ${httpResponse.statusCode}`)
    console.log(`レスポンスヘッダー:`, httpResponse.headers)
    console.log(`レスポンスボディ（最初の500文字）:`, body ? body.substring(0, 500) : "empty")

    if (httpResponse.statusCode === 401) {
      return res.status(401).json({
        error: "認証に失敗しました。ユーザー名またはパスワードが正しくありません。",
        statusCode: 401,
        details: "401 Unauthorized - 認証情報を確認してください",
      })
    }

    if (httpResponse.statusCode === 403) {
      return res.status(403).json({
        error: "アクセスが拒否されました。このユーザーにはAPIへのアクセス権限がありません。",
        statusCode: 403,
        details: "403 Forbidden - 管理者権限が必要な可能性があります",
        suggestion:
          "管理者アカウントでログインするか、APIアクセス権限を確認してください。OAuth2認証の使用も検討してください。",
        troubleshooting: [
          "1. 管理者権限を持つアカウントを使用してください",
          "2. APIアクセス権限がユーザーに付与されているか確認してください",
          "3. APIエンドポイントのURLが正しいか確認してください",
          "4. OAuth2認証を使用することを検討してください",
          "5. テスト用にモックAPIを使用することもできます",
        ],
      })
    }

    if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
      console.error(`APIがステータス ${httpResponse.statusCode} を返しました:`, body)

      let errorMessage = `APIリクエストが失敗しました（ステータス: ${httpResponse.statusCode}）`

      // エラーレスポンスの解析を試行
      try {
        const errorBody = JSON.parse(body)
        if (errorBody.error || errorBody.message) {
          errorMessage += `: ${errorBody.error || errorBody.message}`
        }
      } catch (parseError) {
        // エラーを解析できない場合は、ステータスコードのみを使用
        if (body) {
          errorMessage += `: ${body.substring(0, 200)}`
        }
      }

      return res.status(httpResponse.statusCode).json({
        error: errorMessage,
        statusCode: httpResponse.statusCode,
      })
    }

    try {
      const responseData = JSON.parse(body)

      // Liferay APIレスポンス構造の処理
      let users = []

      if (responseData.items && Array.isArray(responseData.items)) {
        users = responseData.items
      } else if (Array.isArray(responseData)) {
        users = responseData
      } else {
        console.warn("予期しないレスポンス構造:", responseData)
        users = []
      }

      console.log(`[${new Date().toISOString()}] ${users.length}人のユーザーを正常に取得しました`)

      // Liferay API用のテーブル構造に合わせてユーザーを変換
      const transformedUsers = users.map((user) => {
        // カスタムフィールドから会社名を抽出
        let companyName = ""
        if (user.customFields && Array.isArray(user.customFields)) {
          const companyField = user.customFields.find((field) => field.name === "CompanyName")
          if (companyField && companyField.customValue && companyField.customValue.data) {
            companyName = companyField.customValue.data
          }
        }

        // カスタムフィールドから場所を抽出
        let location = ""
        if (user.customFields && Array.isArray(user.customFields)) {
          const locationField = user.customFields.find((field) => field.name === "Location")
          if (locationField && locationField.customValue && locationField.customValue.data) {
            location = locationField.customValue.data
          }
        }

        // 主要な役割名を取得
        let roleNames = ""
        if (user.roleBriefs && Array.isArray(user.roleBriefs)) {
          roleNames = user.roleBriefs.map((role) => role.name).join(", ")
        }

        return {
          id: user.id || "N/A",
          alternateName: user.alternateName || user.givenName || user.name || "N/A",
          givenName: user.givenName || "",
          familyName: user.familyName || "",
          emailAddress: user.emailAddress || "N/A",
          languageId: user.languageId || user.languageDisplayName || "N/A",
          profileURL: user.profileURL || "",
          dateCreated: user.dateCreated || "",
          jobTitle: user.jobTitle || "",
          companyName: companyName,
          location: location,
          roleNames: roleNames,
          status: user.status || "N/A",
          lastLoginDate: user.lastLoginDate || "",
          hasLoginDate: user.hasLoginDate || false,
        }
      })

      res.json({
        success: true,
        users: transformedUsers,
        total: transformedUsers.length,
        totalCount: responseData.totalCount || transformedUsers.length,
        page: responseData.page || 1,
        pageSize: responseData.pageSize || transformedUsers.length,
        authMethod: "Basic",
      })
    } catch (parseError) {
      console.error("APIレスポンスの解析に失敗しました:", parseError)
      console.error("レスポンスボディ:", body)
      res.status(500).json({
        error: "APIレスポンスの解析に失敗しました",
        details: parseError.message,
        responseBody: body ? body.substring(0, 500) : "empty",
      })
    }
  })
})

// テスト用エンドポイント（認証テスト機能を追加）
router.post("/test-auth", (req, res) => {
  console.log("認証テストエンドポイントが呼び出されました")
  const { username, password, apiUrl } = req.body

  if (!username || !password || !apiUrl) {
    return res.status(400).json({
      error: "テストには username, password, apiUrl が必要です",
    })
  }

  // Basic認証文字列を作成
  const userauthStr = "Basic " + Buffer.from(`${username}:${password}`).toString("base64")

  console.log(`認証テスト: ユーザー名=${username}`)
  console.log(`認証ヘッダー: ${userauthStr}`)

  const requestOptions = {
    method: "GET",
    url: apiUrl,
    headers: {
      Authorization: userauthStr,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "User-Management-System-Test/1.0",
    },
    timeout: 10000, // 10秒タイムアウト
  }

  request(requestOptions, (err, httpResponse, body) => {
    if (err) {
      return res.json({
        success: false,
        error: "接続エラー",
        details: err.message,
        testResult: "FAILED",
      })
    }

    res.json({
      success: httpResponse.statusCode >= 200 && httpResponse.statusCode < 300,
      statusCode: httpResponse.statusCode,
      statusText: httpResponse.statusMessage,
      headers: httpResponse.headers,
      bodyPreview: body ? body.substring(0, 200) : "empty",
      testResult: httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 ? "PASSED" : "FAILED",
      authHeader: userauthStr,
    })
  })
})

// Liferay SaaS URL確認エンドポイント
router.post("/test-saas-url", (req, res) => {
  console.log("Liferay SaaS URL確認エンドポイントが呼び出されました")
  const { saasUrl } = req.body

  if (!saasUrl) {
    return res.status(400).json({
      error: "SaaS URLが必要です",
    })
  }

  // URLの基本的な検証
  try {
    const url = new URL(saasUrl)
    if (!url.hostname.includes("liferay.cloud") && !url.hostname.includes("liferay.com")) {
      return res.json({
        success: false,
        error: "有効なLiferay SaaS URLではありません",
        suggestion: "URLは *.liferay.cloud または *.liferay.com ドメインである必要があります",
        testResult: "FAILED",
      })
    }
  } catch (error) {
    return res.json({
      success: false,
      error: "無効なURL形式です",
      details: error.message,
      testResult: "FAILED",
    })
  }

  // 基本的な接続テスト
  const testUrl = `${saasUrl.replace(/\/$/, "")}/o/oauth2/authorize`

  const requestOptions = {
    method: "GET",
    url: testUrl,
    timeout: 10000,
    followRedirect: false,
  }

  console.log(`SaaS URL確認テスト: ${testUrl}`)

  request(requestOptions, (err, httpResponse, body) => {
    if (err) {
      return res.json({
        success: false,
        error: "接続エラー",
        details: err.message,
        testResult: "FAILED",
      })
    }

    // OAuth2エンドポイントが存在するかチェック（200, 302, 401, 403は正常とみなす）
    const validStatusCodes = [200, 302, 401, 403]
    const isValid = validStatusCodes.includes(httpResponse.statusCode)

    res.json({
      success: isValid,
      statusCode: httpResponse.statusCode,
      statusText: httpResponse.statusMessage,
      testResult: isValid ? "PASSED" : "FAILED",
      message: isValid ? "Liferay SaaS URLが確認できました" : `予期しないレスポンス: ${httpResponse.statusCode}`,
      generatedUrls: {
        tokenUrl: `${saasUrl.replace(/\/$/, "")}/o/oauth2/token`,
        apiUrl: `${saasUrl.replace(/\/$/, "")}/o/headless-admin-user/v1.0/user-accounts`,
      },
    })
  })
})

// テスト用エンドポイント
router.get("/test", (req, res) => {
  console.log("テストエンドポイントが呼び出されました")
  res.json({
    message: "APIエンドポイントは正常に動作しています",
    timestamp: new Date().toISOString(),
    routes: [
      "GET /api/test - このテストエンドポイント",
      "POST /api/oauth2-user-list - OAuth2ユーザーリスト取得API",
      "POST /api/oauth2-token - OAuth2トークン取得API",
      "POST /api/test-saas-url - Liferay SaaS URL確認API",
    ],
  })
})

// ヘルスチェックエンドポイント
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "User Management System",
  })
})

module.exports = router
