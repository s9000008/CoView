# CoView (同映) - 跨平台網頁影片同步播放系統

![CoView Banner](https://img.shields.io/badge/Manifest_V3-Chrome_Extension-3b82f6?style=for-the-badge&logo=googlechrome)
![Socket.IO](https://img.shields.io/badge/Socket.io-4.7-010101?style=for-the-badge&logo=socketdotio)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06b6d4?style=for-the-badge&logo=tailwindcss)

> **CoView (同映)** 是一款專為跨地理位置、跨平台網頁設計的即時低延遲影片同步播放系統。結合 Chrome Extension Manifest V3 擴充套件與 Node.js + Socket.IO 高效能架構，讓您與好友無論身在何處都能同步觀看 YouTube 與 Bilibili 影片。

---

## 🌟 專案特色

* 🎬 **跨平台支援**：現行版本支援 **YouTube** (含 SPA 頁面動態導航與廣告過濾) 與 **Bilibili** (動態 DOM 偵測)；雲端硬碟 (Google Drive 等) 與 WebRTC P2P 連線模式列入後續未來預期規劃。
* ⚡ **5 秒時間容差與單程延遲補償**：被動心跳控制在 5 秒差值內不強制跳轉進度（避免抖動卡頓），大於 5 秒強制定位；主動操作 (Play/Pause/Seek) 無視容差強制秒級同步。
* 🌐 **兩大彈性連線架構**：
  1. **預設連線 (Default Relay)**：連線至官方託管 / 本地伺服器，開箱即用免設定。
  2. **自行輸入 IP (Self-Hosted IP)**：支援房主自架主機/NAS/私有雲，透過複合分享碼 (`IP:RoomID|Base64(URL)`) 實現觀眾無感對接。
* 🔒 **多重資安防衛**：
  * **網域白名單防禦**：房主進行網頁跳轉時，觀眾端自動比對 URL 正則白名單，自動攔截惡意釣魚連結。
  * **雙層權限 Drop 防線**：房主關閉「觀眾操作權限」時，非 Host 發送之同步請求會在後端伺服器端直接丟棄。
* 🔋 **MV3 永不斷線保活機制**：採用 `chrome.runtime.connect` Port 長連接與 20 秒 `chrome.alarms` 心跳雙保險，克服 Chrome Service Worker 30 秒休眠限制。

---

## 📁 專案架構

```text
CoView/
├── .env.example             # 專案環境變數範例檔
├── .gitignore                # 版控排除清單
├── README.md                 # 專案完整說明文件
├── CoView_System_Specification.md # 系統規格書 (v2.2)
│
├── server/                   # WebSocket 後端伺服器 (Node.js + Express + Socket.IO)
│   ├── src/
│   │   ├── index.ts          # 伺服器入口與 Socket 事件監聽
│   │   ├── roomManager.ts    # 記憶體房間狀態管理與權限校驗
│   │   └── types.ts          # 伺服器通訊協定型別定義
│   └── package.json
│
├── extension/                # 前端 Chrome 擴充套件 (React 18 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── background/       # Service Worker (Socket 連線、白名單過濾、保活)
│   │   ├── content/          # Content Script (YouTube/Bilibili Video DOM 綁定與補償演算法)
│   │   ├── popup/            # React + Tailwind CSS 房主/觀眾控制面板
│   │   ├── types/            # 前端通訊協定型別
│   │   ├── index.css         # Tailwind 全域樣式
│   │   └── manifest.json     # Chrome Extension MV3 規格說明
│   ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## 🛠️ 安裝與環境變數設定

### 1. 複製環境變數範例

在專案根目錄主動複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

`.env` 設定說明：

| 環境變數 | 預設值 | 說明 |
| :--- | :--- | :--- |
| `PORT` | `3000` | 後端伺服器通訊埠 (Port) |
| `VITE_DEFAULT_SERVER_URL` | `http://localhost:3000` | 前端 Extension 預設連線伺服器位置 |
| `CORS_ORIGIN` | `*` | 跨域請求 CORS 允許來源 |
| `LOG_LEVEL` | `info` | 日誌紀錄等級 |

---

## 🚀 本地開發與測試

### 後端伺服器 (Server)

```bash
# 進入伺服器目錄
cd server

# 安裝依賴套件
npm install

# 啟動開發熱重載 (Dev Mode)
npm run dev

# 測試生產環境建置
npm run build
npm start
```

伺服器啟動後可存取 `http://localhost:3000/health` 確認健康狀態。

### 前端擴充套件 (Extension)

```bash
# 進入擴充套件目錄
cd extension

# 安裝依賴套件
npm install

# 啟動 Vite 熱重載開發模式
npm run dev

# 打包擴充套件 bundle
npm run build
```

#### 在 Chrome 瀏覽器載入套件測試：
1. 開啟 Chrome 瀏覽器，進入 `chrome://extensions/`。
2. 開啟右上角 **「開發者模式」 (Developer mode)**。
3. 點擊 **「載入未打包擴充套件」 (Load unpacked)**。
4. 選擇 `CoView/extension/dist` 資料夾即可完成載入！

---

## 📦 生產環境部署指南

### 1. 後端伺服器部署 (Docker / Railway / Render)

可使用包含 Node.js 20 的 Dockerfile 部署至 Railway、Render 或 GCP / AWS 伺服器：

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 2. GitHub Actions 自動化 CI/CD 流程 (.github/workflows/deploy.yml)

您可以在專案中建立 `.github/workflows/deploy.yml` 實現自動化測試與 GitHub Pages / Releases 發布：

```yaml
name: CoView CI/CD Pipeline

on:
  push:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build Server
        run: |
          cd server
          npm ci
          npm run build

      - name: Build Extension
        run: |
          cd extension
          npm ci
          npm run build

      - name: Archive Extension Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: coview-extension-build
          path: extension/dist/
```

---

## 🔮 未來預期功能 (Roadmap)

* [ ] **WebRTC 點對點直連模式 (Peer-to-Peer DataChannel)**：透過 WebRTC 建立瀏覽器端對端直連，免除伺服器中繼頻寬消耗，達成超低延遲同步。
* [ ] **雲端硬碟同步播放 (Cloud Drive)**：開發專屬授權代理與跨 Iframe 通訊管道，支援 Google Drive 等私有雲端影片同步。
* [ ] **本地影片檔案 P2P 串流播放**：房主選取本機 `.mp4` 影片，透過 P2P 分塊串流讓房間成員即時觀看。
* [ ] **房間即時語音對話 (Voice Chat)**：在觀影過程中提供低延遲背景語音通話。
* [ ] **更多串流平台適配**：拓展支援巴哈姆特動畫瘋、Netflix 等更多主流影音網站。

---

## 📄 授權條款

本專案採用 [MIT License](LICENSE) 釋出。歡迎自由修改與二次開發！
