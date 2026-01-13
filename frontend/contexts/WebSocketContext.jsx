import React, { createContext, useContext } from 'react';
import { useWebSocket } from '../utils/websocket';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext({
  ws: null,
  sendMessage: () => {},
  messages: [],
  isConnected: false
});

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  // 只有用户登录后才连接 WebSocket
  const webSocketData = useWebSocket(!!user);

  return (
    <WebSocketContext.Provider value={webSocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;