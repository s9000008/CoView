import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { RoomManager } from './roomManager';
import {
  CreateRoomReq,
  JoinRoomReq,
  SyncStateMsg,
  RedirectRoomMsg,
  TogglePermissionMsg,
  CreateRoomRes
} from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// 健康檢查 Endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CoView Socket Server', version: '2.0.0' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (_origin, callback) => {
      // 允許所有來源連線，包含 chrome-extension:// 與 localhost
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const roomManager = new RoomManager();

io.on('connection', (socket: Socket) => {
  console.log(`[Socket.IO] 新用戶連線: ${socket.id}`);

  // 1. 建立房間
  socket.on('CREATE_ROOM', (payload: CreateRoomReq) => {
    const { userId, currentUrl, isSelfHosted } = payload.data;
    const room = roomManager.createRoom(socket.id, userId, currentUrl, isSelfHosted ?? false);

    socket.join(room.roomId);

    const response: CreateRoomRes = {
      event: 'CREATE_ROOM_SUCCESS',
      roomId: room.roomId,
      data: {
        allowGuestControl: room.allowGuestControl
      }
    };

    socket.emit('CREATE_ROOM_SUCCESS', response);
  });

  // 2. 加入房間
  socket.on('JOIN_ROOM', (payload: JoinRoomReq) => {
    const { roomId, data } = payload;
    const result = roomManager.joinRoom(roomId, socket.id, data.userId);

    if (!result.success || !result.room) {
      socket.emit('ERROR', { message: result.error || '加入房間失敗' });
      return;
    }

    const room = result.room;
    socket.join(room.roomId);

    socket.emit('JOIN_ROOM_SUCCESS', {
      event: 'JOIN_ROOM_SUCCESS',
      roomId: room.roomId,
      data: {
        allowGuestControl: room.allowGuestControl,
        currentUrl: room.currentUrl,
        isHost: socket.id === room.hostSocketId
      }
    });

    // 通知房間其他成員有新進人員
    socket.to(room.roomId).emit('MEMBER_JOINED', {
      userId: data.userId,
      memberCount: room.members.size
    });

    // 規格 4.1：新人員加入時，向 Host 發送 REQUEST_CURRENT_STATE 拉取最新狀態
    console.log(`[Socket.IO] 向 Host (${room.hostSocketId}) 發送 REQUEST_CURRENT_STATE 拉取狀態給新人員 (${socket.id})`);
    io.to(room.hostSocketId).emit('REQUEST_CURRENT_STATE', {
      event: 'REQUEST_CURRENT_STATE',
      roomId: room.roomId,
      targetGuestSocketId: socket.id
    });
  });

  // 3. 狀態同步廣播 (PLAY / PAUSE / SEEK / HEARTBEAT)
  socket.on('SYNC_STATE', (payload: SyncStateMsg) => {
    const { roomId, data } = payload;
    const room = roomManager.getRoom(roomId);

    if (!room) {
      socket.emit('ERROR', { message: '房間不存在' });
      return;
    }

    // 後端二重安全檢查：未授權之 Guest 廣播直接 Drop
    if (!roomManager.canExecuteAction(socket.id)) {
      console.warn(`[Security Check Drop] Socket ${socket.id} 嘗試觸發 SYNC_STATE 但無權限！`);
      socket.emit('ERROR', { message: '權限不足：目前房主已停用觀眾操作權限' });
      return;
    }

    // 若包含目標 Guest Socket ID，代表是單向回傳狀態給新進觀眾
    if ((payload as any).targetGuestSocketId) {
      const targetId = (payload as any).targetGuestSocketId;
      console.log(`[Socket.IO] 將拉取的初始化狀態獨立回傳給新觀眾: ${targetId}`);
      io.to(targetId).emit('SYNC_STATE', payload);
    } else {
      // 廣播給房間內其他所有成員
      socket.to(room.roomId).emit('SYNC_STATE', payload);
    }
  });

  // 4. 強制網頁跳轉廣播 (REDIRECT_ROOM)
  socket.on('REDIRECT_ROOM', (payload: RedirectRoomMsg) => {
    const { roomId, data } = payload;
    const room = roomManager.getRoom(roomId);

    if (!room) return;

    // 僅 Host 可發起網頁跳轉
    if (room.hostSocketId !== socket.id) {
      console.warn(`[Security Check Drop] 非 Host (${socket.id}) 嘗試觸發 REDIRECT_ROOM`);
      socket.emit('ERROR', { message: '僅房主可進行網頁同步跳轉' });
      return;
    }

    room.currentUrl = data.targetUrl;
    console.log(`[Socket.IO] 廣播網頁跳轉事件: ${data.targetUrl} (Room: ${roomId})`);
    socket.to(room.roomId).emit('REDIRECT_ROOM', payload);
  });

  // 5. 房主權限變更廣播 (TOGGLE_PERMISSION)
  socket.on('TOGGLE_PERMISSION', (payload: TogglePermissionMsg) => {
    const { allowGuestControl } = payload.data;
    const result = roomManager.togglePermission(socket.id, allowGuestControl);

    if (!result.success || !result.room) {
      socket.emit('ERROR', { message: result.error });
      return;
    }

    io.to(result.room.roomId).emit('TOGGLE_PERMISSION', {
      event: 'TOGGLE_PERMISSION',
      roomId: result.room.roomId,
      data: { allowGuestControl }
    });
  });

  // 6. 離線處理
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] 用戶斷開連線: ${socket.id}`);
    const result = roomManager.handleDisconnect(socket.id, (updatedRoom) => {
      // 當 30 秒倒數到達並產生新 Host 時，通知房間內所有人
      io.to(updatedRoom.roomId).emit('HOST_CHANGED', {
        newHostUserId: updatedRoom.hostUserId,
        message: '原房主離線逾時，系統已轉移房主權限權限給新成員'
      });
    });

    if (result.roomId && !result.roomClosed) {
      io.to(result.roomId).emit('MEMBER_LEFT', {
        socketId: socket.id,
        isHost: result.isHost
      });
    }
  });
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ [Port 衝突] 通訊埠 ${PORT} 已被其他執行中程序佔用！`);
  } else {
    console.error(`❌ [伺服器錯誤]`, err);
  }
});

server.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 CoView WebSocket Server 啟動於 http://localhost:${PORT}`);
  console.log(`================================================`);
});
