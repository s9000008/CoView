# Syncine (同映) - 跨平台網頁影片同步播放系統完整開發規格書 (v2.3)

> **環境與用途說明**：本文件專為 **Google Antigravity** 及 AI 開發助理設計。內含三模彈性連線架構（預設官方中繼 / 自架 IP 模式 / WebRTC P2P 直連）、核心同步演算法、MV3 Offscreen 載體、保活防禦、邊界條件、WebSocket 通訊協定（Type Definitions）以及未來預期功能規劃。請嚴格依據此規格書進行前後端程式碼生成與維護。

---

## 1. 專案概述與核心範疇

### 1.1 系統目標
本專案旨在開發一款瀏覽器擴充套件（Chrome Extension V3），配合彈性連線機制（預設中繼、自架伺服器、WebRTC P2P 直連），實現跨地理位置、跨網頁、低延遲的網頁影片「即時同步播放」服務。

### 1.2 支援目標網站（當前版本）
1. **YouTube**：標準網頁版影片播放頁（處理 SPA 網頁架構與廣告過濾）。
2. **Bilibili (嗶哩嗶哩)**：標準網頁版影片播放頁（處理動態載入 DOM）。

> [!NOTE]
> **功能範疇調整說明**：
> 1. **WebRTC P2P 點對點連線**：已於 **v2.3 正式實裝**，採用 Chrome MV3 官方推薦之 `chrome.offscreen` Document 承載 WebRTC DataChannel，並結合現有 Socket 伺服器進行初始 SDP 信令交換與自動降級機制。
> 2. **雲端硬碟**：Google Drive 內嵌影片同步功能列為中長期規劃，詳見第 10 章。

---

## 2. 系統架構與技術棧 (Tech Stack)

### 2.1 整體系統拓撲架構
系統支援兩大傳輸架構：
1. **伺服器中繼架構 (Default Relay & Self-Hosted IP)**：
   `[影片 DOM] <--> [Content Script] <--> [Background SW] <--> [WebSocket Server] <--> [其餘成員 Background SW]`
2. **WebRTC P2P 端對端直連架構 (DataChannel Mode)**：
   `[影片 DOM] <--> [Content Script] <--> [Background SW] <--> [Offscreen Document (WebRTC)] === [DataChannel 直連] === [其餘成員 Offscreen]`

### 2.2 前端套件 (Chrome Extension V3)
* **核心框架**: React 18 + TypeScript + Vite
* **編譯工具**: `@crxjs/vite-plugin` (支援 Extension MV3 的 HMR 熱重載與編譯)
* **樣式庫**: Tailwind CSS
* **通訊客戶端**: `socket.io-client`（WebSocket 傳輸）與原生 `RTCPeerConnection`（位於 Offscreen Document）
* **載體架構**: `chrome.offscreen` API（解決 MV3 Background Service Worker 不支援 WebRTC 原生 API 之限制）

### 2.3 後端伺服器 (Official & Self-Hosted Server)
* **執行環境**: Node.js 20+ / TypeScript
* **核心框架**: Express + Socket.IO
* **核心功能**:
  1. **房間狀態中繼 (Room Relay)**：管理房間生命週期，進行心跳與播放指令廣播。
  2. **二重安全驗證**: 房主權限控制（未經授權之 Guest 指令直接 Drop）。
* **狀態儲存**: 記憶體儲存 (Memory Object)，預留 Redis 介面供叢集化擴展。

---

## 3. 連線方式核心模式規格 (Connection Modes)

系統提供兩種開箱即用與自架掌控之連線選項：

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Syncine 核心連線選項                            │
├───────────────────────────────────┬────────────────────────────────────┤
│ 1. 預設連線模式 (Default Relay)   │ 2. 自行輸入 IP (Self-Hosted IP)    │
├───────────────────────────────────┼────────────────────────────────────┤
│ 官方託管 / 本機開發伺服器         │ 自建私有主機 / VPS / NAS / LAN     │
│ 開箱即用免設定                    │ 複合分享碼無感對接                 │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 3.1 選項一：預設連線模式 (Default Relay Mode)
* **定位**：適合一般大眾使用者，開箱即用、零配置。
* **連線端點**：套件預設連線至伺服器（本地端為 `http://localhost:3000`，生產環境為官方託管端點 `https://api.syncine-official.com`）。
* **傳輸機制**：WebSocket (Socket.IO) 集中式房間中繼轉發。
* **房間代碼**：標準 6 碼代碼（如 `X7A9B2`）或含前綴之 `DEF:X7A9B2`。
* **優點**：無需任何額外配置，即使處於嚴格 NAT 或行動網路皆可順暢連線。

### 3.2 選項二：自行輸入 IP 模式 (Custom IP / Self-Hosted Mode)
* **定位**：適合自架愛好者、內部區域網路（LAN）、私有雲 VPS 或 NAS 使用者。
* **連線端點**：房主在建立房間時，控制面板 UI 提供「自訂伺服器網址/IP」輸入欄位（例如：`http://192.168.1.100:3000` 或 `https://syncine.myhome.net:8443`）。
* **複合型分享碼無感對接機制**：
  1. 房主在自訂伺服器建房成功後，套件將「6 碼 Room ID」與「Base64 編碼後的自訂伺服器網址」透過管道符號 `|` 組裝成最終分享碼：
     - *格式*：`IP:RoomID|Base64(ServerURL)` 或相容格式 `RoomID|Base64(ServerURL)`
     - *範例*：`IP:X7A9B2|aHR0cDovLzE5Mi4xNjguMS4xMDA6MzAwMA==`
  2. 觀眾在套件中貼入該分享碼時，Background Script 自動解析拆解該字串。
  3. 觀眾端套件自動將 WebSocket 連線位置動態切換至解碼後的自訂 IP，並直接發送加入房間請求，觀眾**完全不需要手動輸入 IP**。
* **優點**：資料不經第三方主機、區域網路內極低延遲、不受官方伺服器頻寬與維護限制。

### 3.3 選項三：WebRTC 純端對端直連模式 (Serverless P2P Copy-Paste Mode)
* **定位**：100% 零伺服器依賴、極致低延遲、最高隱私。
* **NAT 穿透**：配置 Google 4 組公共 STUN 伺服器 (`stun:stun.l.google.com:19302`)，免除自建伺服器。
* **信令交換機制 (方案 C - 兩階段剪貼簿握手)**：
  1. **步驟 1 (房主)**：房主點擊「建立 Serverless P2P 房間」，Offscreen 收集完整 ICE 候選項後，使用瀏覽器原生 `CompressionStream('gzip')` 壓縮 SDP 生成 `P2P-OFFER:base64...` 邀請碼，由房主複製傳送給好友。
  2. **步驟 2 (觀眾)**：觀眾貼入邀請碼，Offscreen 解壓後產生對應之 `P2P-ANSWER:base64...` 回執碼，觀眾複製傳回房主。
  3. **步驟 3 (房主確認)**：房主貼入回執碼，雙方 RTCDataChannel 通道立即開啟 (`open`)。
* **優點**：完全不需在本機開啟 Node.js 伺服器（不依賴 `localhost:3000`），高頻同步事件完全端對端直連傳輸。

### 3.4 三種連線選項特性對比表

| 比較項目 | 1. 預設連線模式 | 2. 自行輸入 IP (自架) | 3. ⚡ Serverless P2P 直連 (方案 C) |
| :--- | :--- | :--- | :--- |
| **主機依賴** | 依賴官方/本地伺服器 | 依賴使用者自建伺服器 | **100% 零主機依賴 (免開伺服器)** |
| **信令通道** | WebSocket 伺服器 | WebSocket 伺服器 | 通訊軟體一次性貼上交換 (GZIP) |
| **NAT 穿透** | 伺服器中繼 | 伺服器中繼 / LAN | **Google 公共 STUN 伺服器** |
| **同步延遲** | 良好 (~50-150ms) | 極佳 (內網 ~5-20ms) | **極致 (~10-40ms 網際網路直連)** |
| **伺服器頻寬消耗**| 承擔全量同步指令 | 由自架者全量承擔 | **0 頻寬消耗** |
| **隱私安全性** | 伺服器可知房間狀態 | 完全私有控制 | **端對端直連，最高隱私** |

---

## 4. 核心同步演算法與防禦機制

### 4.1 新進人員狀態初始化拉取機制（Pull Mechanism）
為解決新成員加入房間時，需等待下一次心跳而產生的體驗脫節（Stale State Problem）：
* **實作邏輯**：當新觀影者（Guest）成功加入房間（或 P2P DataChannel 開啟）時，向房主（Host）發送 `REQUEST_CURRENT_STATE` 請求。
* 房主端收到後，立刻回傳當前的精確進度與播放狀態，再轉發給該新 Guest，實現秒級同步初始化。

### 4.2 5 秒時間容差與網路延遲補償演算法
同步邏輯必須嚴格區分「主動操作事件」與「被動定時心跳」。

#### 4.2.1 主動操作事件（無視容差，強制作業）
* 當 **房主**（或獲授權的 Guest）手動點擊觸發 `play`、`pause`、`seek`（拖曳進度條）時，Content Script 捕捉事件並立即發送。
* **觀眾端收到此明確操作指令後，必須無視時間差距，立即強制執行狀態與進度同步。**

#### 4.2.2 被動定時心跳同步（5 秒容差與單程延遲補償）
* **房主端**：每隔 3 秒（`Heartbeat_Interval`），自動獲取影片 `video.currentTime`，連同當前時間戳 `timestamp` 進行心跳廣播。
* **觀影者端**：收到心跳廣播後，結合單程網路延遲（Ping 值補償）執行以下判斷演算法：

```typescript
// AI 實作：5秒容差與延遲補償虛擬碼
const serverSentTime = message.data.currentTime;
const clientReceiveTimestamp = Date.now();
const clientSentTimestamp = message.data.timestamp; // 發送端時間戳

// 計算單程網路延遲 (毫秒轉秒)
const networkLatency = (clientReceiveTimestamp - clientSentTimestamp) / 2 / 1000; 

// 加上延遲補償後的預估目標時間 (僅在播放狀態下補償延遲)
const targetServerTime = serverSentTime + (message.data.action === 'PLAY' ? networkLatency : 0);
const localTime = video.currentTime;
const timeDiff = Math.abs(localTime - targetServerTime);

if (timeDiff > 5) {
    // 差距大於 5 秒，判定進度嚴重脫節，強制修改 DOM 執行校正
    video.currentTime = targetServerTime;
} else {
    // 差距在 5 秒內（含5秒），視為合理網路抖動，不做干預，確保畫面流暢不卡頓
    console.log(`[Syncine] 延遲補償後時間差為 ${timeDiff} 秒，在容差範圍內，忽略同步。`);
}
```

---

## 5. 安全防禦與權限管理

### 5.1 強制跳轉功能與 Host 安全白名單防禦
* 當房主切換新影片並點擊「同步此網頁」時，系統發送 `REDIRECT_ROOM` 事件。
* **資安防禦（防範惡意釣魚跳轉）**：觀眾端套件在調用瀏覽器原生的 `chrome.tabs.update` 前，**必須**透過前端正則表達式進行 Host 白名單過濾，非白名單網址一律攔截。

```javascript
// AI 實作：網域安全過濾規則 (當前支援核心站點)
const HOST_WHITELIST = [
    /^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
    /^https:\/\/www\.bilibili\.com\/video\/[a-zA-Z0-9]+/
];

function verifyAndRedirect(targetUrl) {
    const isSafe = HOST_WHITELIST.some(regex => regex.test(targetUrl));
    if (isSafe) {
        chrome.tabs.update({ url: targetUrl });
    } else {
        console.error("【安全警告】自動攔截未授權的外部跳轉網址！");
        alert("【Syncine 安全警告】房主嘗試將您導向未授權的網址，系統已自動攔截！");
    }
}
```

### 5.2 房主權限控制與雙重攔截機制
房主控制面板設有 `[允許觀眾操作播放器]`（`allow_guest_control: boolean`）開關（預設為關閉）。
* **當開關為 False（禁用觀眾操作）時**：
    1. **前端防線**：當 Guest 嘗試點擊或操作播放器時，Content Script 捕捉到本地事件，立即將影片狀態還原或覆蓋防點擊層阻止操作。
    2. **後端/通道防線（核心安全）**：
       - **伺服器模式**：若 Guest 強行發送 `SYNC_STATE` 請求，後端伺服器校驗其 Socket 身分。若發送者非 Host，後端**直接丟棄（Drop）該請求**。
       - **P2P 模式**：房主端（Host Peer）在 DataChannel 監聽來自 Guest 的事件時，若 `allow_guest_control === false`，房主直接丟棄該訊息，不予本地執行與轉發。

---

## 6. Chrome Extension MV3 限制與保活架構 (Keep-Alive)

由於 Chrome Manifest V3 的 Background Service Worker 會在不活動 30 秒後自動休眠，導致長連接中斷，AI 實作時必須包含以下**保活機制**：

1. **Port 長連接保活**：當任何支援的影片網頁開啟且套件啟用時，Content Script 必須與 Background Script 建立 `chrome.runtime.connect({ name: "syncine-keepalive" })` 通道。只要此通道維持開啟狀態，Service Worker 就不會進入休眠。
2. **Alarm 喚醒備援**：Background Script 必須註冊一個每 20 秒執行一次的 `chrome.alarms` 監聽器。每次觸發時，向連線端點發送輕量心跳（Ping/Pong），強制重新整理生命週期。

---

## 7. 目標平台整合指南 (DOM 選擇器)

AI 在編寫 Content Script 時，請針對當前核心支援平台採用以下選擇器與注入策略：

### 7.1 YouTube
* **Video 選擇器**：`document.querySelector('video.html5-main-video')`
* **整合重點**：
  - YouTube 屬於 SPA（單頁應用）架構，切換影片時網頁不重新整理。必須監聽 `yt-navigate-finish` 事件，並搭配 `MutationObserver`，一旦偵測到 URL 改變，立即重新綁定 Video 監聽器。
  - **廣告過濾**：當頁面偵測到廣告元素（如 `.video-ads`、`.ytp-ad-player-overlay`）存在時，進入「廣告靜默狀態」，期間暫停發送與接收所有進度同步信號。

### 7.2 Bilibili (嗶哩嗶哩)
* **Video 選擇器**：`document.querySelector('.bpx-player-video-wrap video')`
* **整合重點**：影片 DOM 元素採非同步動態載入。Content Script 啟動時元素可能尚未生成，必須使用 `MutationObserver` 監聽父節點，直到目標 `<video>` 出現在 DOM 中再行綁定。

---

## 8. 通訊協定與信令規格 (Protocol Schema)

請嚴格按照以下 TypeScript 型別定義來實作通訊與信令序列化邏輯：

```typescript
// 連線模式列舉
export type ConnectionMode = 'DEFAULT' | 'CUSTOM_IP';

export type SyncineEvent = 
  | 'CREATE_ROOM' 
  | 'CREATE_ROOM_SUCCESS' 
  | 'JOIN_ROOM' 
  | 'JOIN_ROOM_SUCCESS' 
  | 'REQUEST_CURRENT_STATE' 
  | 'SYNC_STATE' 
  | 'REDIRECT_ROOM' 
  | 'TOGGLE_PERMISSION' 
  | 'ERROR';

export interface SyncinePayload<T = any> {
  event: SyncineEvent;
  roomId?: string;
  data?: T;
}

// 1. 建立房間請求 (Client -> Server)
export interface CreateRoomReq {
  event: 'CREATE_ROOM';
  data: {
    userId: string;
    currentUrl: string;
    mode: ConnectionMode;
    customServerUrl?: string; // 僅在 mode === 'CUSTOM_IP' 時填寫
  };
}

// 2. 建立房間成功 (Server -> Client)
export interface CreateRoomRes {
  event: 'CREATE_ROOM_SUCCESS';
  roomId: string;
  data: {
    mode: ConnectionMode;
    shareCode: string; // 預設 6 碼或自架複合碼 (IP:RoomID|Base64)
    allowGuestControl: boolean;
  };
}

// 3. 加入房間請求 (Client -> Server)
export interface JoinRoomReq {
  event: 'JOIN_ROOM';
  roomId: string;
  data: {
    userId: string;
    mode: ConnectionMode;
  };
}

// 4. 狀態初始化拉取請求 (Guest -> Host)
export interface RequestCurrentStateMsg {
  event: 'REQUEST_CURRENT_STATE';
  roomId: string;
}

// 5. 狀態同步信號
export interface SyncStateMsg {
  event: 'SYNC_STATE';
  roomId: string;
  targetGuestSocketId?: string;
  data: {
    action: 'PLAY' | 'PAUSE' | 'SEEK' | 'HEARTBEAT';
    currentTime: number; // 影片秒數，精確到小數點後三位以上
    paused?: boolean;    // 播放/暫停旗標
    timestamp: number;   // 發送端 Date.now()
  };
}

// 6. 強制網頁跳轉廣播 (Host -> Server -> Guest)
export interface RedirectRoomMsg {
  event: 'REDIRECT_ROOM';
  roomId: string;
  data: {
    targetUrl: string; // 目標新影片網址（需通過白名單）
  };
}

// 7. 房主權限變更廣播
export interface TogglePermissionMsg {
  event: 'TOGGLE_PERMISSION';
  roomId: string;
  data: {
    allowGuestControl: boolean;
  };
}
```

---

## 9. 異常處理與邊界條件 (AI 開發檢查清單)

AI 在編寫實作代碼時，請確認完全覆蓋以下異常邊界：
* [x] **緩衝卡頓處理**：當某一觀影者觸發瀏覽器原生 `waiting` (Buffering) 事件並持續超過 5 秒時，向房間發送 `PAUSE`，避免成員進度嚴重落後，同時防止網路輕微波動造成過度頻繁暫停。
* [x] **時間軸跳轉對齊**：主動 SEEK 事件除校準時間戳外，雙向同步發送端之 `paused` 狀態，避免跳轉後接收端定格暫停。
* [ ] **廣告干擾隔離**：在 YouTube 等平台廣告播放期間，嚴格暫停發送與接收同步事件，避免廣告時長干擾正片進度。
* [ ] **斷線重連機制**：`socket.io` 實作指數型退避重連；重連成功後自動攜帶 Room ID 重新註冊。
* [ ] **房主離線處理**：當 Host 斷線超過 30 秒未恢復，通知房間成員並依設定引導解散或升級首位 Guest 為新房主。

---

## 10. 未來預期功能規劃 (Future Roadmap)

以下項目列為中長期預期功能，當前核心版本暫不實裝，但系統架構設計需保留介面以利平滑擴充：

### 10.1 WebRTC 點對點直連模式 (已於 v2.3 實裝)
* 系統已正式實裝 WebRTC P2P DataChannel 星狀拓撲直連與 MV3 Offscreen Document 載體架構，規格詳見第 3.3 節。

### 10.2 雲端硬碟同步播放 (Cloud Drive Integration)
* **需求背景**：使用者期望與好友同步觀看儲存於雲端硬碟（Google Drive、OneDrive、Dropbox）上的私有影片。
* **當前技術痛點與移出原因**：
  1. **跨網域 Iframe 存取限制**：Google Drive 預覽介面中的 `<video>` 標籤深嵌於跨網域 Iframe（如 `docs.google.com`），受同源政策（SOP）阻擋，Content Script 注入與事件監聽難度高。
  2. **身分驗證與檔案共用限制**：每位觀影者之 Google 帳號與存取權限不同，若檔案未公開共用，其餘成員將無法開啟影片。
* **未來實作規劃方案**：
  - **階段一**：開發專屬 Google Drive API 授權代理，直接獲取影片串流直連網址（Direct Streaming URL）。
  - **階段二**：藉由套件背景權限與 `postMessage` 建立跨 Iframe 通訊管道，並重構白名單規則（`drive.google.com`, `docs.google.com`）。

### 10.3 本地檔案 P2P 同步播放 (Local Video Streaming / WebTorrent)
* 允許房主選取電腦本地影片檔案（`.mp4`, `.mkv`），利用 WebRTC DataChannel 分塊傳輸（Chunking）或 WebTorrent 技術，免上傳雲端直接點對點同步串流至觀眾瀏覽器播放。

### 10.4 房間即時語音通話 (WebRTC Voice Chat)
* 在既有的 WebRTC 通道上附加音訊軌（Audio Track），讓同房間好友在觀影過程中進行超低延遲語音對話，免切換第三方語音軟體。

### 10.5 更多主流影音串流平台支援
* 逐步適配 Netflix、Disney+、巴哈姆特動畫瘋等平台，針對各平台動態 DOM、DRM 加密播放器與按鈕做專屬防禦適配。
