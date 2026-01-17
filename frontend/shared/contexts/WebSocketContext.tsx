import React, { createContext, useContext } from 'react';
import { useWebSocket } from '@/utils/websocket';
import { useAuth } from './AuthContext';
import type { WebSocketMessage } from '@/shared/types';

export interface WebSocketContextValue {
  ws: WebSocket | null;
  sendMessage: (message: any) => void;
  messages: WebSocketMessage[];
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export const useWebSocketContext = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const webSocketData = useWebSocket(!!user);

  return (
    <WebSocketContext.Provider value={webSocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
