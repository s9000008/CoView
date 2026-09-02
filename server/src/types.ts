export type ConnectionMode = 'DEFAULT' | 'CUSTOM_IP' | 'P2P';

export type CoViewEvent = 
  | 'CREATE_ROOM' 
  | 'CREATE_ROOM_SUCCESS' 
  | 'JOIN_ROOM' 
  | 'JOIN_ROOM_SUCCESS' 
  | 'REQUEST_CURRENT_STATE' 
  | 'SYNC_STATE' 
  | 'REDIRECT_ROOM' 
  | 'TOGGLE_PERMISSION' 
  | 'SIGNAL_OFFER'
  | 'SIGNAL_ANSWER'
  | 'SIGNAL_ICE_CANDIDATE'
  | 'ERROR';

export interface CoViewPayload {
  event: CoViewEvent;
  roomId?: string;
  data?: any;
}

export interface CreateRoomReq {
  event: 'CREATE_ROOM';
  data: {
    userId: string;
    currentUrl: string;
    isSelfHosted?: boolean;
    mode?: ConnectionMode;
    customServerUrl?: string;
  };
}

export interface CreateRoomRes {
  event: 'CREATE_ROOM_SUCCESS';
  roomId: string;
  data: {
    allowGuestControl: boolean;
    mode?: ConnectionMode;
    shareCode?: string;
  };
}

export interface JoinRoomReq {
  event: 'JOIN_ROOM';
  roomId: string;
  data: {
    userId: string;
    mode?: ConnectionMode;
  };
}

export interface RequestCurrentStateMsg {
  event: 'REQUEST_CURRENT_STATE';
  roomId: string;
}

export interface SyncStateMsg {
  event: 'SYNC_STATE';
  roomId: string;
  targetGuestSocketId?: string;
  data: {
    action: 'PLAY' | 'PAUSE' | 'SEEK' | 'HEARTBEAT';
    currentTime: number;
    timestamp: number;
    paused?: boolean;
  };
}

export interface RedirectRoomMsg {
  event: 'REDIRECT_ROOM';
  roomId: string;
  data: {
    targetUrl: string;
  };
}

export interface TogglePermissionMsg {
  event: 'TOGGLE_PERMISSION';
  roomId: string;
  data: {
    allowGuestControl: boolean;
  };
}

export interface SignalOfferMsg {
  event: 'SIGNAL_OFFER';
  roomId: string;
  data: {
    targetUserId: string;
    senderUserId: string;
    sdp: any;
  };
}

export interface SignalAnswerMsg {
  event: 'SIGNAL_ANSWER';
  roomId: string;
  data: {
    targetUserId: string;
    senderUserId: string;
    sdp: any;
  };
}

export interface SignalIceCandidateMsg {
  event: 'SIGNAL_ICE_CANDIDATE';
  roomId: string;
  data: {
    targetUserId: string;
    senderUserId: string;
    candidate: any;
  };
}

export interface RoomMember {
  socketId: string;
  userId: string;
  isHost: boolean;
  joinedAt: number;
}

export interface RoomState {
  roomId: string;
  hostSocketId: string;
  hostUserId: string;
  currentUrl: string;
  allowGuestControl: boolean;
  isSelfHosted: boolean;
  members: Map<string, RoomMember>;
  hostDisconnectTimer?: NodeJS.Timeout;
}
