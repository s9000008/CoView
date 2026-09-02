export type ConnectionMode = 'DEFAULT' | 'CUSTOM_IP';

export type CoViewEvent = 
  | 'CREATE_ROOM' 
  | 'CREATE_ROOM_SUCCESS' 
  | 'JOIN_ROOM' 
  | 'JOIN_ROOM_SUCCESS' 
  | 'REQUEST_CURRENT_STATE' 
  | 'SYNC_STATE' 
  | 'REDIRECT_ROOM' 
  | 'TOGGLE_PERMISSION' 
  | 'ERROR';

export interface SyncData {
  action: 'PLAY' | 'PAUSE' | 'SEEK' | 'HEARTBEAT';
  currentTime: number;
  timestamp: number;
  paused?: boolean;
}

export interface RoomStateInfo {
  roomId: string;
  isHost: boolean;
  allowGuestControl: boolean;
  serverUrl: string;
  currentUrl?: string;
  mode?: ConnectionMode;
}

// Content Script <-> Background 通訊 payload
export interface ExtensionMessage {
  type: 
    | 'BG_CREATE_ROOM'
    | 'BG_JOIN_ROOM'
    | 'BG_SYNC_STATE'
    | 'BG_REDIRECT_ROOM'
    | 'BG_TOGGLE_PERMISSION'
    | 'BG_LEAVE_ROOM'
    | 'CS_SYNC_RECEIVED'
    | 'CS_REDIRECT_RECEIVED'
    | 'CS_PERMISSION_UPDATED'
    | 'GET_ROOM_STATE';
  payload?: any;
}
