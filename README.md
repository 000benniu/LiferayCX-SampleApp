# Liferay Client Extension Sample App [日本語はこちらへ](./readme_jp.md)

## 🔧 Setup Instructions

### 1. Clone the Repository and Install Dependencies

Please run the following commands:

```bash
git clone https://github.com/000benniu/LiferayCX-SampleApp.git
cd your-repo
npm install
```

### 2. Run Locally
```bash
npm run dev
```
After starting, you can access [localhost:8090](http://localhost:8090/) in your browser.

### 3. Deploy to Remote Environment
```bash
lcp deploy
```
⚠️ After deployment, it may take several minutes to several hours for the [Network/Port settings](https://learn.liferay.com/w/liferay-cloud/configuring-the-cloud-network/load-balancer) on Liferay Cloud to be applied. Please note that the extension may not be available immediately while waiting for these changes to take effect.
