# Liferay Client Extension サンプルアプリ

## 🔧 セットアップ手順

### 1. リポジトリのクローンと依存関係のインストール

以下のコマンドを実行してください：

```bash
git clone https://github.com/000benniu/LiferayCX-SampleApp.git
cd your-repo
npm install
```

### 2. ローカルでの実行
```bash
npm run dev
```
起動後、ブラウザで[localhost:8090](http://localhost:8090/)にアクセスできます。

### 3. リモート環境へのデプロイ
```bash
lcp deploy
```
⚠️ デプロイ後、Liferay Cloud側の[Network・Port設定](https://learn.liferay.com/w/liferay-cloud/configuring-the-cloud-network/load-balancer)が反映されるまで数分～数時間かかる場合があります。反映待ちの間、拡張が即座に利用できないことがありますのでご注意ください。
