# Syncine (同映) 隱私權政策 (Privacy Policy)

最後更新日期：2026 年 9 月 5 日

Syncine（以下簡稱「本擴充套件」）致力於保障每位使用者的個人隱私。本隱私權政策旨在清楚說明本套件對使用者資料的處理原則及各項權限的使用目的。

---

## 1. 零個資收集原則 (Zero Personal Data Collection)
本擴充套件秉持「最小權限」與「保護使用者個資」原則：
- 我們**不會收集、記錄、儲存、追蹤或傳輸**任何個人識別資訊（包含您的姓名、電子郵件、IP 位址、電話或帳號密碼）。
- 我們**不會收集**您的網頁瀏覽歷史、影片觀看偏好、搜尋記錄或任何私人通訊資料。

---

## 2. 權限需求與單一用途說明
本擴充套件向瀏覽器申請的所有權限，均嚴格受限於實現「跨平台影片同步播放」之單一核心功能：

1. **儲存空間 (storage)**：
   僅用於在您當前的瀏覽器本機端儲存隨機生成的匿名客戶端識別碼（User ID）及自訂伺服器偏好設定，確保重新開啟瀏覽器時連線設定不遺失。相關資料完全保存在您的本機裝置，絕不上傳。

2. **分頁資訊 (tabs & activeTab)**：
   僅用於偵測目前使用中的 YouTube 或 Bilibili 影片播放分頁狀態（例如偵測分頁關閉、跳轉或重新整理），以便即時切斷同步連線或傳送播放控制指令，絕不讀取與影片同步無關之分頁資訊。

3. **鬧鐘排程 (alarms)**：
   依據 Chrome Manifest V3 規範，用於在背景 Service Worker 閒置時維持輕量的心跳健康檢查，避免影片同步連線無故中斷。

4. **螢幕外文件 (offscreen)**：
   用於建立背景隔離之安全沙盒環境，以維持 WebRTC 點對點（P2P）資料通道的連線生命週期。

5. **主機網站存取權限 (Host Permissions)**：
   存取範圍僅限於支援之影音平台（YouTube 與 Bilibili）及中繼伺服器（syncine.fly.dev 或自架主機），僅用於讀取/控制影片播放器之時間戳記（播放、暫停、跳轉），絕不截取使用者的登入憑證或個人資料。

---

## 3. 同步傳輸機制與影音版權
- **僅傳送控制訊號**：房間內同步傳遞的數據僅包含「播放 (PLAY)」、「暫停 (PAUSE)」及「影片當前秒數 (currentTime)」等數值信號。
- **不涉及影音串流**：本套件絕不重播、轉播或側錄影片影音本體。所有視訊與音訊皆直接由官方影音平台（YouTube / Bilibili）官方伺服器向您的瀏覽器串流，畫質無損且完全合規。
- **P2P 端對端直連**：在 WebRTC 模式下，控制信號直接於使用者雙方瀏覽器間加密傳輸，不經過任何第三方雲端伺服器。

---

## 4. 資料分享與第三方服務
- 我們絕不會將使用者之個人身分資料出售、出租或移轉給任何第三方機構。
- 我們不會將任何使用者資料用於個人信用評等或貸款用途。
- 未來若有引入第三方服務或合作展示，我們將嚴格遵守 Google Chrome Web Store Developer Program 政策並即時更新揭露資訊。

---

## 5. 政策更新與問題聯繫
若本隱私權政策有任何修改，我們將直接更新於本文件與專案主頁。如果您對本政策有任何疑問，歡迎透過我們的專案儲存庫提出：
專案原始碼與問題回報：https://github.com/s9000008/Syncine

---

# Privacy Policy for Syncine (English Version)

Last Updated: September 5, 2026

Syncine ("the extension") is committed to protecting your privacy. This Privacy Policy details our data handling practices and single-purpose permission requirements.

## 1. Zero Personal Data Collection
We strictly operate under a policy that respects your personal information:
- We DO NOT collect, store, track, or transmit any personally identifiable information (such as name, email, IP address, or passwords).
- We DO NOT collect browsing history, viewing habits, search history, or personal communications.

## 2. Permissions Justification
All requested permissions are solely used for video playback synchronization:
- `storage`: Saves random anonymous user IDs and connection preferences locally.
- `tabs` & `activeTab`: Detects playback state on supported YouTube/Bilibili tabs.
- `alarms`: Maintains keepalive heartbeats under Chrome Manifest V3.
- `offscreen`: Maintains persistent WebRTC (P2P) data channel lifecycles.
- Host Permissions: Restricted to YouTube, Bilibili, and relay servers to synchronize play/pause/seek events.

## 3. Playback Synchronization
Syncine only transmits playback control signals (play, pause, current timestamp). Video and audio streams are directly delivered from YouTube/Bilibili servers. No media is re-hosted or intercepted.

## 4. Third-Party Services
We do not sell, rent, or transfer personal user data to third parties. Any future third-party integrations will strictly comply with the Google Chrome Web Store Developer Program Policies.

## 5. Contact & Inquiries
For questions or issues, please reach out via our GitHub repository:
https://github.com/s9000008/Syncine
