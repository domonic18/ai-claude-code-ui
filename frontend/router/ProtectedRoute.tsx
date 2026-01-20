import React, { useEffect } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { SetupForm, LoginForm } from '@/features/auth';
import { MessageSquare } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { APP_NAME } from '@/shared/constants/app.constants';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
}

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
          <MessageSquare className="w-8 h-8 text-primary-foreground" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">{APP_NAME}</h1>
      <div className="flex items-center justify-center space-x-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
      <p className="text-muted-foreground mt-2">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading, needsSetup, checkAuthStatus } = useAuth();

  // 当访问受保护路由时，才触发认证检查
  useEffect(() => {
    if (import.meta.env.VITE_IS_PLATFORM !== 'true') {
      checkAuthStatus();
    }
  }, []);

  if (import.meta.env.VITE_IS_PLATFORM === 'true') {
    if (isLoading) {
      return <LoadingScreen />;
    }

    return <>{children}</>;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (needsSetup) {
    return <SetupForm />;
  }

  if (!user) {
    return <LoginForm />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
