# 認可サーバーの実装

Authlete を利用した認可サーバーの実装を実装します。 Authlete は OpenID Connect/OAuth エンジンを API として提供します。
認可サーバーの実装者はフロントエンドの認可サーバーを構築し、その認可サーバーの中で Authlete API を呼び出します。
今回のハンズオンでは http://localhost:9000 で動作する Web サーバーを認可サーバーのフロントエンドとして利用します。

![](https://www.authlete.com/img/developers/overview/authletes-role-in-authorization.png)

## 実装するエンドポイント

このハンズオンでは JWT 形式のアクセストークンを発行する認可サーバーを構築します。
MCP サーバーが JWT 形式のアクセストークンを検証できるよう、メタデーターを公開します。

実装する OAuth/OIDC のエンドポイントは以下の通りです。

1. 認可エンドポイント (/authorize)
2. トークンエンドポイント (/token)
3. OpenID Discovery エンドポイント (/.well-known/openid-configuration)
4. JWK セットエンドポイント (/jwks)

また、以下のエンドポイントについても実装します。

5. ユーザー同意結果取得エンドポイント (/consent)

## 実装しない内容

以下はこのハンズオンでは実装しません。

* ユーザー認証とセッション管理 (デモユーザーが認証済みという前提で実装します)
* ユーザーが同意可能な権限の判定 (クライアントがリクエストした権限にはすべて同意可能とします)
* トークンに含めるクレームなどの判定 (あらかじめ設定したデモユーザーのクレームを埋め込みます)
* CSRF などのセキュリティ対策

時間に余裕があれば追加課題として取り組んでみても良いでしょう。

## 利用ライブラリ

ハンズオンでは beta リリースされている [@authlete/typescript-sdk](https://github.com/authlete/authlete-typescript-sdk) を利用します。
Web サーバーには [hono](https://hono.dev/) を利用していますが、express など、使慣れたフレームワークで実装しても構いません。
