import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useUserRole } from '@/features/auth/hooks/useAuth';
import { MessageSquare } from 'lucide-react';
import { APP_NAME } from '@/shared/constants/app.constants';

/**
 * 应用加载中的占位屏幕
 */
const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
          <MessageSquare className="w-8 h-8 text-primary-foreground" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">{APP_NAME}</h1>
      <p className="text-muted-foreground mt-2">Loading...</p>
    </div>
  </div>
);

/**
 * Admin 路由守卫：仅 admin 角色可访问子路由，其他已登录用户重定向到 /chat
 * 必须嵌套在 ProtectedRoute 内部使用（依赖 user 已就绪）
 */
const AdminRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin } = useUserRole();

  if (isLoading) {
    return <LoadingScreen />;
  }

  // 平台模式或 admin 放行；非 admin 已登录用户重定向回聊天页
  const isPlatformMode = import.meta.env.VITE_IS_PLATFORM === 'true';
  if (user && (isAdmin || isPlatformMode)) {
    return <Outlet />;
  }

  return <Navigate to="/chat" replace />;
};

export default AdminRoute;
