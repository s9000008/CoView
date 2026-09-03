import { RoomState, RoomMember, ConnectionMode } from './types';

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private socketToRoom: Map<string, string> = new Map();

  /**
   * 產生 6 碼大寫英數字 Room ID
   */
  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    do {
      result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(result));
    return result;
  }

  /**
   * 建立新房間
   */
  public createRoom(
    socketId: string,
    userId: string,
    currentUrl: string,
    isSelfHosted: boolean,
    mode: ConnectionMode = 'DEFAULT'
  ): RoomState {
    const roomId = this.generateRoomId();
    const hostMember: RoomMember = {
      socketId,
      userId,
      isHost: true,
      joinedAt: Date.now()
    };

    const room: RoomState = {
      roomId,
      hostSocketId: socketId,
      hostUserId: userId,
      currentUrl,
      allowGuestControl: false,
      isSelfHosted,
      mode,
      members: new Map([[socketId, hostMember]])
    };

    this.rooms.set(roomId, room);
    this.socketToRoom.set(socketId, roomId);

    console.log(`[RoomManager] 房間建立成功: ${roomId} (Host: ${userId}, Socket: ${socketId})`);
    return room;
  }

  /**
   * 觀眾加入房間
   */
  public joinRoom(
    roomId: string,
    socketId: string,
    userId: string
  ): { success: boolean; room?: RoomState; error?: string } {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      return { success: false, error: '房間不存在或已關閉' };
    }

    // 若有 Host 離線計時器，當原 Host 重連時取消
    if (userId === room.hostUserId) {
      if (room.hostDisconnectTimer) {
        clearTimeout(room.hostDisconnectTimer);
        room.hostDisconnectTimer = undefined;
        console.log(`[RoomManager] 房主重連，取消離線倒數: ${roomId}`);
      }
      room.hostSocketId = socketId;
    }

    const isHost = userId === room.hostUserId;
    const member: RoomMember = {
      socketId,
      userId,
      isHost,
      joinedAt: Date.now()
    };

    room.members.set(socketId, member);
    this.socketToRoom.set(socketId, roomId);

    console.log(`[RoomManager] 使用者 ${userId} (${isHost ? 'Host' : 'Guest'}) 加入房間 ${roomId}`);
    return { success: true, room };
  }

  /**
   * 取得特定 Socket 所屬房間
   */
  public getRoomBySocketId(socketId: string): RoomState | undefined {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /**
   * 取得特定 Room ID 之房間
   */
  public getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  /**
   * 切換房間權限 (僅 Host 可操作)
   */
  public togglePermission(
    socketId: string,
    allowGuestControl: boolean
  ): { success: boolean; room?: RoomState; error?: string } {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return { success: false, error: '找不到對應房間' };

    if (room.hostSocketId !== socketId) {
      console.warn(`[RoomManager Security Warning] 非 Host 嘗試修改權限 (Socket: ${socketId})`);
      return { success: false, error: '權限不足：僅房主可修改權限' };
    }

    room.allowGuestControl = allowGuestControl;
    console.log(`[RoomManager] 房間 ${room.roomId} 權限更新: allowGuestControl = ${allowGuestControl}`);
    return { success: true, room };
  }

  /**
   * 驗證 Socket 是否具備操作權限 (Host 或允許 Guest 控制)
   */
  public canExecuteAction(socketId: string): boolean {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return false;
    if (room.hostSocketId === socketId) return true;
    return room.allowGuestControl;
  }

  /**
   * 處理成員離線邏輯
   */
  public handleDisconnect(
    socketId: string,
    onHostTimeout: (room: RoomState) => void
  ): { roomId?: string; isHost: boolean; roomClosed: boolean } {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return { isHost: false, roomClosed: false };

    const room = this.rooms.get(roomId);
    this.socketToRoom.delete(socketId);

    if (!room) return { roomId, isHost: false, roomClosed: false };

    const member = room.members.get(socketId);
    const isHost = member?.isHost || room.hostSocketId === socketId;
    room.members.delete(socketId);

    console.log(`[RoomManager] Socket ${socketId} 離開房間 ${roomId}`);

    if (room.members.size === 0) {
      // 房間全空，清理房間
      if (room.hostDisconnectTimer) clearTimeout(room.hostDisconnectTimer);
      this.rooms.delete(roomId);
      console.log(`[RoomManager] 房間 ${roomId} 已無成員，自動銷毀`);
      return { roomId, isHost, roomClosed: true };
    }

    if (isHost) {
      console.log(`[RoomManager] 房主離線，啟動 30 秒等待重新連線計時器: ${roomId}`);
      room.hostDisconnectTimer = setTimeout(() => {
        const currentRoom = this.rooms.get(roomId);
        if (!currentRoom) return;

        // 若 30 秒內 Host 沒重連，自動尋找最先加入的 Guest 提升為新 Host
        const remainingMembers = Array.from(currentRoom.members.values()).sort(
          (a, b) => a.joinedAt - b.joinedAt
        );

        if (remainingMembers.length > 0) {
          const newHost = remainingMembers[0];
          newHost.isHost = true;
          currentRoom.hostSocketId = newHost.socketId;
          currentRoom.hostUserId = newHost.userId;
          console.log(`[RoomManager] 30秒逾時！房間 ${roomId} 新 Host 提升為: ${newHost.userId}`);
          onHostTimeout(currentRoom);
        } else {
          this.rooms.delete(roomId);
          console.log(`[RoomManager] 30秒逾時且無其餘成員，關閉房間 ${roomId}`);
        }
      }, 30000);
    }

    return { roomId, isHost, roomClosed: false };
  }
}
