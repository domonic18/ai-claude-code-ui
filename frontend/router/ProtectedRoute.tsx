import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/contexts/AuthContext';
import { SetupForm, LoginForm } from '@/features/auth';
import { MessageSquare } from 'lucide-react';
import { Outlet } from 'react-router-dom';

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
      <h1 className="text-2xl font-bold text-foreground mb-2">Claude Code UI</h1>
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
  const location = useLocation();
  const [hasCheckedSaml, setHasCheckedSaml] = useState(false);
  const [isCheckingSaml, setIsCheckingSaml] = useState(false);

  // 检查是否是 SAML 登录成功后的重定向
  const urlParams = new URLSearchParams(location.search);
  const isSamlSuccess = urlParams.get('saml') === 'success';

  // 当访问受保护路由时，才触发认证检查
  useEffect(() => {
    if (import.meta.env.VITE_IS_PLATFORM === 'true') {
      return;
    }

    // 如果是 SAML 登录成功，强制重新检查认证状态
    if (isSamlSuccess && !hasCheckedSaml) {
      setHasCheckedSaml(true);
      setIsCheckingSaml(true);
      checkAuthStatus(true).then(() => {
        setIsCheckingSaml(false);
        // 移除 URL 参数
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }).catch(() => {
        setIsCheckingSaml(false);
      });
    } else {
      checkAuthStatus();
    }
  }, [isSamlSuccess, hasCheckedSaml, checkAuthStatus]);

  if (import.meta.env.VITE_IS_PLATFORM === 'true') {
    if (isLoading) {
      return <LoadingScreen />;
    }

    return <>{children}</>;
  }

  // 如果正在检查 SAML 认证状态，显示加载界面
  if (isCheckingSaml) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <MessageSquare className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Claude Code UI</h1>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-muted-foreground mt-2">Logging in...</p>
        </div>
      </div>
    );
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
