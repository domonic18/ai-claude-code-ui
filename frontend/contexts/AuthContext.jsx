import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext({
  user: null,
  login: () => {},
  register: () => {},
  logout: () => {},
  isLoading: true,
  needsSetup: false,
  hasCompletedOnboarding: true,
  refreshOnboardingStatus: () => {},
  error: null
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('[AuthContext] useEffect triggered, VITE_IS_PLATFORM:', import.meta.env.VITE_IS_PLATFORM);
    if (import.meta.env.VITE_IS_PLATFORM === 'true') {
      setUser({ username: 'platform-user' });
      setNeedsSetup(false);
      checkOnboardingStatus();
      setIsLoading(false);
      return;
    }

    console.log('[AuthContext] Calling checkAuthStatus...');
    checkAuthStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const response = await api.user.onboardingStatus();

      // 检查 content-type，确保是 JSON 响应
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[AuthContext] onboarding-status returned non-JSON response');
        setHasCompletedOnboarding(true);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setHasCompletedOnboarding(data.hasCompletedOnboarding);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasCompletedOnboarding(true);
    }
  };

  const refreshOnboardingStatus = async () => {
    await checkOnboardingStatus();
  };

  const checkAuthStatus = async () => {
    console.log('[AuthContext] checkAuthStatus called, isLoading:', isLoading);
    try {
      setIsLoading(true);
      setError(null);

      // Check if system needs setup
      const statusResponse = await api.auth.status();
      const statusData = await statusResponse.json();

      // Handle both direct response and responseFormatter format
      const needsSetupValue = statusData.data?.needsSetup ?? statusData.needsSetup ?? false;

      if (needsSetupValue) {
        setNeedsSetup(true);
        setIsLoading(false);
        return;
      }

      // 使用 cookie 认证，直接尝试获取用户信息
      try {
        console.log('[AuthContext] Fetching user from /api/auth/user...');
        const userResponse = await api.auth.user();
        console.log('[AuthContext] User response status:', userResponse.status);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('[AuthContext] User data received:', userData);
          const extractedUser = userData.data?.user ?? userData.user;
          console.log('[AuthContext] Extracted user:', extractedUser);
          setUser(extractedUser);
          console.log('[AuthContext] setUser called');
          setNeedsSetup(false);
          await checkOnboardingStatus();
        } else {
          // 未认证或 cookie 无效
          console.warn('[AuthContext] User fetch failed:', userResponse.status);
          setUser(null);
        }
      } catch (error) {
        console.error('User fetch failed:', error);
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Auth status check failed:', error);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      const response = await api.auth.login(username, password);

      // Check if response is not JSON (e.g., HTML error page)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorMessage = 'Server error. Please check the server logs.';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const data = await response.json();

      if (response.ok) {
        // 使用 cookie 认证，token 已由后端设置到 cookie
        setUser(data.data?.user ?? data.user);
        return { success: true };
      } else {
        setError(data.error || 'Login failed');
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (username, password) => {
    try {
      setError(null);
      const response = await api.auth.register(username, password);

      const data = await response.json();

      if (response.ok) {
        // 使用 cookie 认证，token 已由后端设置到 cookie
        setUser(data.data?.user ?? data.user);
        setNeedsSetup(false);
        return { success: true };
      } else {
        setError(data.error || 'Registration failed');
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    setUser(null);
    // 调用后端清除 cookie
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout endpoint error:', error);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    isLoading,
    needsSetup,
    hasCompletedOnboarding,
    refreshOnboardingStatus,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};