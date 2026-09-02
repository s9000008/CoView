import { io, Socket } from 'socket.io-client';
import { RoomStateInfo } from '../types/protocol';
import { DEFAULT_SERVER_URL } from '../config';

// 規格 5.1 安全白名單 (支援 YouTube 各種參數排列、Bilibili 一般影片與番劇)
const HOST_WHITELIST = [
  /^https:\/\/www\.youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]+/,
  /^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
  /^https:\/\/www\.bilibili\.com\/video\/[a-zA-Z0-9]+/,
  /^https:\/\/www\.bilibili\.com\/bangumi\/play\/(ep|ss)[0-9]+/
];

let socket: Socket | null = null;
let currentRoomState: RoomStateInfo | null = null;
let userId: string = 'user_' + Math.random().toString(36).substring(2, 9);

// 在 Chrome MV3 Service Worker 中使用 chrome.storage.local 代替 localStorage
chrome.storage?.local?.get(['coview_user_id'], (result) => {
  if (result?.coview_user_id) {
    userId = result.coview_user_id;
  } else {
    chrome.storage?.local?.set({ coview_user_id: userId });
  }
});

// ----------------------------------------------------
// 1. MV3 保活機制 (Keep-Alive)
// ----------------------------------------------------
// 保活通道 1: Port 連接監聽
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'coview-keepalive') {
    console.log('[Background] 收到 Content Script 長連接保活 Port');
    port.onDisconnect.addListener(() => {
      console.log('[Background] Content Script Port 斷開');
    });
  }
});

// 保活通道 2: Alarm 備援 (每 20 秒觸發一次)
chrome.alarms.create('coview-ping-alarm', { periodInMinutes: 0.33 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'coview-ping-alarm') {
    if (socket && socket.connected) {
      socket.emit('PING_ALIVE', { timestamp: Date.now() });
      console.log('[Background Keep-Alive] 發送 Alarm 輕量 Ping');
    }
  }
});

// ----------------------------------------------------
// 2. 資安防禦：網域白名單過濾跳轉
// ----------------------------------------------------
function verifyAndRedirect(targetUrl: string) {
  const isSafe = HOST_WHITELIST.some((regex) => regex.test(targetUrl));
  if (isSafe) {
    console.log(`[Background] 通過安全白名單，跳轉至: ${targetUrl}`);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.update(tabs[0].id, { url: targetUrl });
      }
    });
  } else {
    console.error(`[CoView 資安警告] 攔截非白名單跳轉網址: ${targetUrl}`);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SHOW_SECURITY_ALERT',
          payload: { url: targetUrl }
        });
      }
    });
  }
}

// ----------------------------------------------------
// 3. WebSocket 初始化與 Socket.IO 連線
// ----------------------------------------------------
function initSocketConnection(serverUrl: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    // 若已有相同伺服器之連線且狀態正常，直接重用
    if (socket && socket.connected && (socket as any)._serverUrl === serverUrl) {
      console.log(`[Background] 重用現有 Socket.IO 連線: ${serverUrl}`);
      return resolve(socket);
    }

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    console.log(`[Background] 初始化 Socket.IO 連線: ${serverUrl}`);
    
    // 在 Chrome MV3 Service Worker 環境中，強制使用 websocket transport
    // 避免因 Service Worker 缺乏 XMLHttpRequest 導致 polling 連線中斷
    socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000,
      timeout: 5000
    });
    (socket as any)._serverUrl = serverUrl;

    let isSettled = false;
    const connectTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error(`連線逾時：無法連線至伺服器 (${serverUrl})，請確認伺服器已啟動且 Port 正確`));
      }
    }, 6000);

    socket.once('connect', () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(connectTimer);
        console.log(`[Background] Socket.IO 已成功連線至: ${serverUrl} (ID: ${socket?.id})`);
        resolve(socket!);
      }
    });

    socket.once('connect_error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(connectTimer);
        console.error(`[Background] Socket.IO 連線失敗 (${serverUrl}):`, err.message);
        reject(new Error(`連線失敗：無法連線至 ${serverUrl} (${err.message || '請確認伺服器已啟動'})`));
      }
    });

    // 接收 SYNC_STATE 訊息轉發至 Content Script
    socket.on('SYNC_STATE', (data) => {
      console.log('[Background] 收到 SYNC_STATE，廣播給頁面 Content Script:', data);
      broadcastToVideoTabs({
        type: 'CS_SYNC_RECEIVED',
        payload: data
      });
    });

    // 接收 REQUEST_CURRENT_STATE (Host 被要求回傳當前狀態給新觀眾)
    socket.on('REQUEST_CURRENT_STATE', (data) => {
      console.log('[Background] 收到 REQUEST_CURRENT_STATE，請 Host Content Script 報備進度:', data);
      broadcastToVideoTabs({
        type: 'CS_REQUEST_CURRENT_STATE',
        payload: data
      });
    });

    // 接收 REDIRECT_ROOM 網頁跳轉
    socket.on('REDIRECT_ROOM', (data) => {
      console.log('[Background] 收到 REDIRECT_ROOM 網頁跳轉:', data);
      if (data.data?.targetUrl) {
        verifyAndRedirect(data.data.targetUrl);
      }
    });

    // 接收 TOGGLE_PERMISSION 權限變更
    socket.on('TOGGLE_PERMISSION', (data) => {
      if (currentRoomState) {
        currentRoomState.allowGuestControl = data.data.allowGuestControl;
      }
      broadcastToVideoTabs({
        type: 'CS_PERMISSION_UPDATED',
        payload: data.data
      });
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[Background] WebSocket 連線中斷: ${reason}`);
    });
  });
}

function broadcastToVideoTabs(msg: any) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id && tab.url && (tab.url.includes('youtube.com') || tab.url.includes('bilibili.com'))) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    });
  });
}

// ----------------------------------------------------
// 4. 解析複合分享碼 (RoomID|Base64(ServerURL))
// ----------------------------------------------------
function parseShareCode(inputCode: string): { roomId: string; serverUrl: string } {
  let trimmed = inputCode.trim();

  // 支援 IP: 或 DEF: 前綴過濾
  if (trimmed.startsWith('IP:')) {
    trimmed = trimmed.substring(3);
  } else if (trimmed.startsWith('DEF:')) {
    trimmed = trimmed.substring(4);
  }

  if (trimmed.includes('|')) {
    const [roomId, base64Url] = trimmed.split('|');
    try {
      const decodedUrl = atob(base64Url);
      return { roomId: roomId.toUpperCase(), serverUrl: decodedUrl };
    } catch (e) {
      console.error('Base64 解碼失敗，使用預設伺服器');
    }
  }
  return { roomId: trimmed.toUpperCase(), serverUrl: DEFAULT_SERVER_URL };
}

// ----------------------------------------------------
// 5. Message 監聽器 (來自 Popup 與 Content Script)
// ----------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, payload } = request;

  switch (type) {
    case 'BG_CREATE_ROOM': {
      const mode = payload?.mode || 'DEFAULT';
      const serverUrl = payload?.customServerUrl || DEFAULT_SERVER_URL;

      initSocketConnection(serverUrl)
        .then((s) => {
          s.emit('CREATE_ROOM', {
            event: 'CREATE_ROOM',
            data: {
              userId,
              currentUrl: payload.currentUrl,
              isSelfHosted: mode === 'CUSTOM_IP' || !!payload.customServerUrl,
              mode,
              customServerUrl: mode === 'CUSTOM_IP' ? serverUrl : undefined
            }
          });

          const createTimer = setTimeout(() => {
            sendResponse({ success: false, error: '伺服器回應逾時 (CREATE_ROOM_SUCCESS 未收到)' });
          }, 6000);

          s.once('CREATE_ROOM_SUCCESS', (res: any) => {
            clearTimeout(createTimer);
            // 組裝複合分享代碼: RoomID|Base64(ServerURL)
            const base64Url = btoa(serverUrl);
            let compositeCode = `${res.roomId}|${base64Url}`;
            if (mode === 'CUSTOM_IP') {
              compositeCode = `IP:${res.roomId}|${base64Url}`;
            }

            currentRoomState = {
              roomId: res.roomId,
              isHost: true,
              allowGuestControl: res.data.allowGuestControl,
              serverUrl,
              currentUrl: payload.currentUrl,
              mode
            };

            // 通知分頁 Content Script 房間已建立並已指派為 Host
            broadcastToVideoTabs({
              type: 'CS_ROOM_STATE_CHANGED',
              payload: currentRoomState
            });

            sendResponse({ success: true, compositeCode, roomId: res.roomId, roomState: currentRoomState });
          });
        })
        .catch((err) => {
          console.error('[Background] BG_CREATE_ROOM 失敗:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // 保持 async sendResponse
    }

    case 'BG_JOIN_ROOM': {
      const { roomId, serverUrl } = parseShareCode(payload.shareCode);
      initSocketConnection(serverUrl)
        .then((s) => {
          s.emit('JOIN_ROOM', {
            event: 'JOIN_ROOM',
            roomId,
            data: { userId }
          });

          const joinTimer = setTimeout(() => {
            sendResponse({ success: false, error: '伺服器回應逾時 (JOIN_ROOM_SUCCESS 未收到)' });
          }, 6000);

          s.once('JOIN_ROOM_SUCCESS', (res: any) => {
            clearTimeout(joinTimer);
            currentRoomState = {
              roomId: res.roomId,
              isHost: false,
              allowGuestControl: res.data.allowGuestControl,
              serverUrl,
              currentUrl: res.data.currentUrl
            };

            // 通知分頁 Content Script 房間已加入（Guest 角色）
            broadcastToVideoTabs({
              type: 'CS_ROOM_STATE_CHANGED',
              payload: currentRoomState
            });

            sendResponse({ success: true, roomId: res.roomId, roomState: currentRoomState });
          });

          s.once('ERROR', (err: any) => {
            clearTimeout(joinTimer);
            sendResponse({ success: false, error: err.message });
          });
        })
        .catch((err) => {
          console.error('[Background] BG_JOIN_ROOM 失敗:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    case 'BG_SYNC_STATE': {
      if (socket && currentRoomState) {
        const syncData = payload?.data ?? request.data;
        const targetGuestSocketId = payload?.targetGuestSocketId ?? request.targetGuestSocketId;

        socket.emit('SYNC_STATE', {
          event: 'SYNC_STATE',
          roomId: currentRoomState.roomId,
          targetGuestSocketId,
          data: syncData
        });
      }
      break;
    }

    case 'BG_REDIRECT_ROOM': {
      if (socket && currentRoomState && currentRoomState.isHost) {
        verifyAndRedirect(payload.targetUrl);
        socket.emit('REDIRECT_ROOM', {
          event: 'REDIRECT_ROOM',
          roomId: currentRoomState.roomId,
          data: { targetUrl: payload.targetUrl }
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: '非 Host 無法發起跳轉' });
      }
      return true;
    }

    case 'BG_TOGGLE_PERMISSION': {
      if (socket && currentRoomState && currentRoomState.isHost) {
        currentRoomState.allowGuestControl = payload.allowGuestControl;
        broadcastToVideoTabs({
          type: 'CS_PERMISSION_UPDATED',
          payload: { allowGuestControl: payload.allowGuestControl }
        });
        socket.emit('TOGGLE_PERMISSION', {
          event: 'TOGGLE_PERMISSION',
          roomId: currentRoomState.roomId,
          data: { allowGuestControl: payload.allowGuestControl }
        });
        sendResponse({ success: true });
      }
      return true;
    }

    case 'BG_LEAVE_ROOM': {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      currentRoomState = null;
      broadcastToVideoTabs({
        type: 'CS_ROOM_STATE_CHANGED',
        payload: null
      });
      sendResponse({ success: true });
      break;
    }

    case 'GET_ROOM_STATE': {
      sendResponse({ roomState: currentRoomState, userId });
      break;
    }
  }
});
