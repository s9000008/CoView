import React, { useState, useEffect } from 'react';
import {
  Tv,
  Users,
  Copy,
  Check,
  Shield,
  Share2,
  Server,
  LogOut,
  ExternalLink,
  Loader2,
  Plus,
  Radio,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Video
} from 'lucide-react';
import { RoomStateInfo, ConnectionMode } from '../types/protocol';
import { DEFAULT_SERVER_URL, IS_LOCAL_DEV } from '../config';

export default function Popup() {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomState, setRoomState] = useState<RoomStateInfo | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // 連線模式下拉選單 (預設為 DEFAULT 固定伺服器)
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('DEFAULT');
  const [customServerUrl, setCustomServerUrl] = useState<string>('');
  const [shareCodeInput, setShareCodeInput] = useState<string>('');
  const [compositeCode, setCompositeCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState<string>('');

  useEffect(() => {
    // 獲取當前分頁網址
    chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setActiveTabUrl(tabs[0].url);
      }
    });

    // 獲取房間狀態
    chrome.runtime?.sendMessage?.({ type: 'GET_ROOM_STATE' }, (res) => {
      if (res?.roomState) {
        setRoomState(res.roomState);
      }
      if (res?.userId) {
        setUserId(res.userId);
      }
    });
  }, []);

  const isYouTube = activeTabUrl.includes('youtube.com/watch');
  const isBilibili = activeTabUrl.includes('bilibili.com/video') || activeTabUrl.includes('bilibili.com/bangumi');
  const isTargetSite = isYouTube || isBilibili;

  const handleCreateRoom = () => {
    setLoading(true);
    setErrorMessage(null);

    // 依連線模式決定伺服器網址
    let targetServerUrl = DEFAULT_SERVER_URL;
    if (connectionMode === 'CUSTOM_IP') {
      if (!customServerUrl.trim()) {
        setErrorMessage('請輸入自架伺服器 IP 或網址 (例如: http://192.168.1.100:3000)');
        setLoading(false);
        return;
      }
      targetServerUrl = customServerUrl.trim();
    }

    chrome.runtime.sendMessage(
      {
        type: 'BG_CREATE_ROOM',
        payload: {
          currentUrl: activeTabUrl,
          mode: connectionMode,
          customServerUrl: connectionMode === 'CUSTOM_IP' ? targetServerUrl : undefined
        }
      },
      (res) => {
        setLoading(false);
        if (res?.success) {
          setRoomState(res.roomState);
          setCompositeCode(res.compositeCode);
        } else {
          setErrorMessage(res?.error || '建立房間失敗，請確認伺服器是否已啟動');
        }
      }
    );
  };

  const handleJoinRoom = () => {
    if (!shareCodeInput.trim()) {
      setErrorMessage('請輸入房間代碼或複合分享碼');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    chrome.runtime.sendMessage(
      {
        type: 'BG_JOIN_ROOM',
        payload: { shareCode: shareCodeInput.trim() }
      },
      (res) => {
        setLoading(false);
        if (res?.success) {
          setRoomState(res.roomState);
        } else {
          setErrorMessage(res?.error || '加入房間失敗，請確認代碼或伺服器連線');
        }
      }
    );
  };

  const handleLeaveRoom = () => {
    chrome.runtime.sendMessage({ type: 'BG_LEAVE_ROOM' }, () => {
      setRoomState(null);
      setCompositeCode('');
      setActiveTab('create');
    });
  };

  const handleTogglePermission = (allow: boolean) => {
    chrome.runtime.sendMessage(
      {
        type: 'BG_TOGGLE_PERMISSION',
        payload: { allowGuestControl: allow }
      },
      () => {
        if (roomState) {
          setRoomState({ ...roomState, allowGuestControl: allow });
        }
      }
    );
  };

  const handleSyncCurrentTab = () => {
    if (!activeTabUrl) return;
    chrome.runtime.sendMessage({
      type: 'BG_REDIRECT_ROOM',
      payload: { targetUrl: activeTabUrl }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-[380px] bg-slate-900 text-slate-100 p-4 font-sans border border-slate-800 rounded-xl shadow-2xl flex flex-col justify-between">
      {/* 頂部 Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/25">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
                  CoView (同映)
                </h1>
                <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">
                  v2.1
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {IS_LOCAL_DEV ? 'Local 本機開發環境' : 'Cloud 官方環境'}
              </p>
            </div>
          </div>

          {roomState && (
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm ${
                roomState.isHost
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}
            >
              {roomState.isHost ? '👑 房主 (Host)' : '👀 觀眾 (Guest)'}
            </span>
          )}
        </div>

        {/* 當前分頁狀態提示條 */}
        <div
          className={`mb-3 p-2 rounded-lg text-[11px] flex items-center justify-between border ${
            isTargetSite
              ? 'bg-blue-950/40 text-blue-300 border-blue-800/50'
              : 'bg-amber-950/30 text-amber-300 border-amber-800/40'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate max-w-[280px]">
            <Video className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {isYouTube
                ? '🎬 YouTube 影片分頁已連線'
                : isBilibili
                ? '📺 Bilibili 影片分頁已連線'
                : '💡 建議開啟 YouTube 或 Bilibili 網頁以進行同步'}
            </span>
          </div>
          {isTargetSite && (
            <span className="text-[10px] text-blue-400 font-semibold bg-blue-900/60 px-1.5 py-0.5 rounded border border-blue-700/50">
              支援
            </span>
          )}
        </div>

        {/* 錯誤提示 */}
        {errorMessage && (
          <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300 px-1">
              ✕
            </button>
          </div>
        )}

        {/* 未在房間時：提供「建立房間」與「加入房間」明確頁籤 */}
        {!roomState ? (
          <div>
            {/* 核心功能分頁切換按鈕 */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800 mb-3.5">
              <button
                onClick={() => {
                  setActiveTab('create');
                  setErrorMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                建立房間 (Host)
              </button>

              <button
                onClick={() => {
                  setActiveTab('join');
                  setErrorMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'join'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                加入房間 (Guest)
              </button>
            </div>

            {/* TAB 1: 建立房間面板 */}
            {activeTab === 'create' && (
              <div className="space-y-3 bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                {/* 1. 連線方式下拉選單 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-blue-400" />
                      連線方式 (Connection Mode)
                    </span>
                    <span className="text-[10px] text-blue-400 font-normal">兩種選項</span>
                  </label>

                  <div className="relative">
                    <select
                      value={connectionMode}
                      onChange={(e) => setConnectionMode(e.target.value as ConnectionMode)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition appearance-none cursor-pointer pr-8"
                    >
                      <option value="DEFAULT">
                        1. 預設固定伺服器 ({IS_LOCAL_DEV ? 'Local 本地主機' : '官方雲端'})
                      </option>
                      <option value="CUSTOM_IP">2. 自行輸入 IP (用於自架主機 / LAN)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* 2. 模式對應參數卡片 */}
                {connectionMode === 'DEFAULT' && (
                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">固定伺服器位置:</span>
                      <span className="font-mono text-emerald-400 font-semibold">{DEFAULT_SERVER_URL}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      開箱即用，免額外設定，由系統提供之中央主機中繼同步播放。
                    </p>
                  </div>
                )}

                {connectionMode === 'CUSTOM_IP' && (
                  <div className="p-2.5 bg-slate-950/70 border border-blue-900/40 rounded-lg space-y-1.5">
                    <label className="text-[11px] text-slate-300 block font-medium">
                      自訂伺服器網址 / IP 位址:
                    </label>
                    <input
                      type="text"
                      placeholder="例如: http://192.168.1.100:3000"
                      value={customServerUrl}
                      onChange={(e) => setCustomServerUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                    <p className="text-[10px] text-slate-400">
                      建房後將生成複合分享碼，訪客直接貼入即可自動切換至該 IP 連線。
                    </p>
                  </div>
                )}

                {/* 3. 建立房間按鈕 (顯眼大按鈕) */}
                <button
                  id="btn-create-room"
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 border border-blue-400/30 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>正在建立房間...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">🚀 立即建立房間 (Create Room)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: 加入房間面板 */}
            {activeTab === 'join' && (
              <div className="space-y-3 bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    房間代碼或分享碼
                  </label>
                  <input
                    type="text"
                    placeholder="貼入 6 碼代碼 (如 X7A9B2) 或複合碼"
                    value={shareCodeInput}
                    onChange={(e) => setShareCodeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    支援一般 6 碼或自架複合碼 (IP:...)，貼上後自動解析端點。
                  </p>
                </div>

                <button
                  id="btn-join-room"
                  onClick={handleJoinRoom}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:from-indigo-700 active:to-violet-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 border border-indigo-400/30 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>正在加入房間...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span className="text-sm">🔑 加入同步房間 (Join Room)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 已在房間時的控制面板 */
          <div className="space-y-3">
            {/* 房間代碼卡片 */}
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    房間代碼 (Room Code)
                  </span>
                  <p className="text-xl font-mono font-extrabold text-blue-400 tracking-wider">
                    {roomState.roomId}
                  </p>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(
                      compositeCode || `${roomState.roomId}|${btoa(roomState.serverUrl)}`
                    )
                  }
                  className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition active:scale-95 font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '已複製分享碼' : '複製分享碼'}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-700/60 pt-2">
                <span className="truncate max-w-[200px]" title={roomState.serverUrl}>
                  主機: {roomState.serverUrl}
                </span>
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  連線同步中
                </span>
              </div>
            </div>

            {/* 房主專屬控制區 */}
            {roomState.isHost && (
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" /> 房主權限管理
                </h3>

                {/* 允許觀眾操作切換 */}
                <div className="flex items-center justify-between p-2 bg-slate-900/70 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-300">允許觀眾控制播放/暫停</span>
                  <button
                    onClick={() => handleTogglePermission(!roomState.allowGuestControl)}
                    className={`w-10 h-5 flex items-center rounded-full p-1 transition duration-300 ${
                      roomState.allowGuestControl ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition duration-300 ${
                        roomState.allowGuestControl ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 強制網頁跳轉同步 */}
                <button
                  onClick={handleSyncCurrentTab}
                  className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  將全房觀眾跳轉至當前網頁
                </button>
              </div>
            )}

            {/* 房內快捷操作按鈕 */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleLeaveRoom}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs transition flex items-center justify-center gap-1.5 font-medium"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                建立新房間
              </button>

              <button
                onClick={handleLeaveRoom}
                className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs transition flex items-center justify-center gap-1.5 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                離開房間
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 底部 Footer */}
      <div className="mt-4 pt-2.5 border-t border-slate-800/80 text-center text-[10px] text-slate-500 flex items-center justify-between">
        <span>CoView Engine • 支援 YouTube / Bilibili</span>
        <span className="font-mono text-slate-400">{IS_LOCAL_DEV ? 'Local:3000' : 'Official'}</span>
      </div>
    </div>
  );
}

