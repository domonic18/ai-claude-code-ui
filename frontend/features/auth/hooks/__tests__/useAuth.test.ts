/**
 * useAuth Hooks Tests
 *
 * Tests for the auth-related custom hooks:
 * - useAuth: wraps AuthContext with additional methods
 * - useUserRole: checks user role permissions
 * - usePermissions: checks user permissions
 * - useAuthStatus: provides authentication status
 * - useUserSettings: manages user settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock AuthContext before importing hooks
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLogout = vi.fn();
const mockSharedAuth = {
  user: null as any,
  login: mockLogin,
  register: mockRegister,
  logout: mockLogout,
  checkAuthStatus: vi.fn(),
  isLoading: false,
  needsSetup: false,
  error: null as string | null,
};

vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => mockSharedAuth,
}));

// Mock authService
const mockAuthService = {
  updateUser: vi.fn(),
  refreshUser: vi.fn(),
};

vi.mock('@/features/auth/services', () => ({
  getAuthService: () => mockAuthService,
}));

// Mock logger
vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  useAuth,
  useUserRole,
  usePermissions,
  useAuthStatus,
  useUserSettings,
} from '../useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharedAuth.user = null;
    mockSharedAuth.isLoading = false;
    mockSharedAuth.needsSetup = false;
    mockSharedAuth.error = null;
    mockLogin.mockResolvedValue({ success: true });
    mockRegister.mockResolvedValue({ success: true });
    mockLogout.mockResolvedValue(undefined);
  });

  it('should return unauthenticated state when no user', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return authenticated state when user exists', () => {
    mockSharedAuth.user = { username: 'testuser', role: 'user' };

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual({ username: 'testuser', role: 'user' });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should expose isLoading from shared auth', () => {
    mockSharedAuth.isLoading = true;

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
  });

  it('should expose needsSetup from shared auth', () => {
    mockSharedAuth.needsSetup = true;

    const { result } = renderHook(() => useAuth());

    expect(result.current.needsSetup).toBe(true);
  });

  it('should expose error from shared auth', () => {
    mockSharedAuth.error = 'Session expired';

    const { result } = renderHook(() => useAuth());

    expect(result.current.error).toBe('Session expired');
  });

  it('should delegate login to shared auth', async () => {
    mockLogin.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());

    const response = await result.current.login({
      username: 'user1',
      password: 'pass1',
    });

    expect(mockLogin).toHaveBeenCalledWith('user1', 'pass1');
    expect(response.success).toBe(true);
  });

  it('should handle login error', async () => {
    mockLogin.mockResolvedValue({ success: false, error: 'Invalid credentials' });

    const { result } = renderHook(() => useAuth());

    const response = await result.current.login({
      username: 'user1',
      password: 'wrong',
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('Invalid credentials');
  });

  it('should delegate register to shared auth', async () => {
    mockRegister.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());

    const response = await result.current.register({
      username: 'newuser',
      password: 'pass123',
    });

    expect(mockRegister).toHaveBeenCalledWith('newuser', 'pass123');
    expect(response.success).toBe(true);
  });

  it('should handle register error', async () => {
    mockRegister.mockResolvedValue({ success: false, error: 'User exists' });

    const { result } = renderHook(() => useAuth());

    const response = await result.current.register({
      username: 'existing',
      password: 'pass',
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('User exists');
  });

  it('should delegate logout to shared auth', async () => {
    const { result } = renderHook(() => useAuth());

    await result.current.logout();

    expect(mockLogout).toHaveBeenCalled();
  });

  it('should delegate refreshUser to authService', async () => {
    mockAuthService.refreshUser.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());

    await result.current.refreshUser();

    expect(mockAuthService.refreshUser).toHaveBeenCalled();
  });
});

describe('useUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharedAuth.user = null;
  });

  it('should return guest role when no user', () => {
    const { result } = renderHook(() => useUserRole());

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isUser).toBe(false);
    expect(result.current.isGuest).toBe(true);
  });

  it('should detect admin role', () => {
    mockSharedAuth.user = { username: 'admin', role: 'admin' };

    const { result } = renderHook(() => useUserRole());

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isUser).toBe(true); // admin is also a user
    expect(result.current.isGuest).toBe(false);
  });

  it('should detect regular user role', () => {
    mockSharedAuth.user = { username: 'user1', role: 'user' };

    const { result } = renderHook(() => useUserRole());

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isUser).toBe(true);
    expect(result.current.isGuest).toBe(false);
  });

  it('should detect guest role explicitly', () => {
    mockSharedAuth.user = { username: 'guest1', role: 'guest' };

    const { result } = renderHook(() => useUserRole());

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isUser).toBe(false);
    expect(result.current.isGuest).toBe(true);
  });

  it('hasRole should check exact role match', () => {
    mockSharedAuth.user = { username: 'admin', role: 'admin' };

    const { result } = renderHook(() => useUserRole());

    expect(result.current.hasRole('admin')).toBe(true);
    expect(result.current.hasRole('user')).toBe(false);
    expect(result.current.hasRole('guest')).toBe(false);
  });
});

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharedAuth.user = null;
  });

  it('should deny all permissions for guest', () => {
    mockSharedAuth.user = { username: 'guest1', role: 'guest' };

    const { result } = renderHook(() => usePermissions());

    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canShare).toBe(false);
  });

  it('should grant basic permissions for regular user', () => {
    mockSharedAuth.user = { username: 'user1', role: 'user' };

    const { result } = renderHook(() => usePermissions());

    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(false); // only admin
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canShare).toBe(true);
  });

  it('should grant all permissions for admin', () => {
    mockSharedAuth.user = { username: 'admin', role: 'admin' };

    const { result } = renderHook(() => usePermissions());

    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canShare).toBe(true);
  });
});

describe('useAuthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharedAuth.user = null;
    mockSharedAuth.isLoading = false;
    localStorage.clear();
  });

  it('should return unauthenticated when not authenticated and not loading', () => {
    const { result } = renderHook(() => useAuthStatus());

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.error).toBeNull();
  });

  it('should return loading when auth is loading', () => {
    mockSharedAuth.isLoading = true;

    const { result } = renderHook(() => useAuthStatus());

    expect(result.current.status).toBe('loading');
  });

  it('should return authenticated when user exists', () => {
    mockSharedAuth.user = { username: 'user1', role: 'user' };

    const { result } = renderHook(() => useAuthStatus());

    expect(result.current.status).toBe('authenticated');
  });

  it('should read auth error from localStorage', () => {
    localStorage.setItem('authError', 'Session expired');

    const { result } = renderHook(() => useAuthStatus());

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Session expired');
    // Should clear the error from localStorage after reading
    expect(localStorage.getItem('authError')).toBeNull();
  });
});

describe('useUserSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharedAuth.user = null;
    mockAuthService.updateUser.mockResolvedValue(undefined);
  });

  it('should return undefined settings when no user', () => {
    const { result } = renderHook(() => useUserSettings());

    expect(result.current.settings).toBeUndefined();
  });

  it('should return user settings when user exists', () => {
    mockSharedAuth.user = {
      username: 'user1',
      role: 'user',
      settings: { theme: 'dark', language: 'en' },
    };

    const { result } = renderHook(() => useUserSettings());

    expect(result.current.settings).toEqual({ theme: 'dark', language: 'en' });
  });

  it('should update settings via updateUser', async () => {
    mockSharedAuth.user = {
      username: 'user1',
      role: 'user',
      settings: { theme: 'light' },
    };

    const { result } = renderHook(() => useUserSettings());

    await result.current.updateSettings({ language: 'zh' });

    expect(mockAuthService.updateUser).toHaveBeenCalledWith({
      settings: { theme: 'light', language: 'zh' },
    });
  });

  it('should not update settings when no user', async () => {
    const { result } = renderHook(() => useUserSettings());

    await result.current.updateSettings({ theme: 'dark' });

    expect(mockAuthService.updateUser).not.toHaveBeenCalled();
  });

  it('should reset settings to empty object', async () => {
    mockSharedAuth.user = {
      username: 'user1',
      role: 'user',
      settings: { theme: 'dark' },
    };

    const { result } = renderHook(() => useUserSettings());

    await result.current.resetSettings();

    expect(mockAuthService.updateUser).toHaveBeenCalledWith({ settings: {} });
  });
});
