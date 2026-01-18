# 前端页面架构重构与新功能实施计划

**文档版本:** 1.0
**创建日期:** 2025-01-17
**基于文档:** docs/arch/frontend-organization-structure.md
**当前阶段:** 计划阶段

---

## 执行摘要

本计划包含四个主要任务：
1. **页面架构重构** - 从单页应用迁移到多页面路由结构
2. **国际化系统** - 实现中英文双语支持
3. **首页创建** - 产品介绍落地页
4. **用户菜单增强** - 顶部用户信息显示和下拉菜单

---

## 一、当前状态分析

### 1.1 现有架构

**路由结构:**
```
当前 (App.tsx):
├── "/" → AppContent (主应用界面)
└── "/session/:sessionId" → AppContent (会话详情)

认证流程 (ProtectedRoute.tsx):
未登录 → LoginForm → SetupForm → OnboardingPage → AppContent
```

**目录结构:**
```
frontend/
├── pages/                    # 仅包含全局页面
│   ├── ErrorPage.tsx
│   ├── NotFoundPage.tsx
│   ├── LoadingPage.tsx
│   └── Onboarding/
│       ├── OnboardingPage.tsx
│       └── index.ts
├── features/                 # 功能模块（完整）
│   ├── chat/                # 聊天功能
│   ├── settings/            # 设置功能（模态框形式）
│   ├── sidebar/             # 侧边栏导航
│   └── auth/                # 认证功能
└── App.tsx                  # 主组件（554行）
```

**认证系统:**
- ✅ AuthContext 完整实现 (shared/contexts/AuthContext.tsx)
- ✅ JWT token 认证
- ✅ httpOnly cookie 存储
- ✅ 24小时会话过期
- ✅ 平台模式（单用户）支持

### 1.2 差距分析

| 需求 | 当前状态 | 目标状态 |
|------|---------|---------|
| 页面路由 | 单页应用，状态切换 | React Router 多页面 |
| 国际化 | 无 | react-i18next 中英文 |
| 首页 | 无 | 产品介绍落地页 |
| 用户菜单 | 无 | 头部用户昵称+下拉菜单 |
| Chat页面 | 集成在 AppContent | 独立 pages/Chat/ |
| Settings页面 | 模态框形式 | 独立 pages/Settings/ |

---

## 二、实施计划

### 阶段 1: 页面架构重构 (P0)

**目标:** 建立标准的多页面路由结构，为后续功能打基础

#### 1.1 创建页面组件结构

**新增文件:**
```bash
frontend/pages/Homepage/
├── Homepage.tsx              # 首页主组件
├── components/
│   ├── HeroSection.tsx      # 英雄区（主标题+CTA）
│   ├── FeaturesSection.tsx  # 功能特性展示
│   └── CTAButton.tsx        # 登录按钮组件
├── types/
│   └── homepage.types.ts
└── index.ts

frontend/pages/Chat/
├── ChatPage.tsx              # 聊天页面（从 AppContent 提取）
├── components/
│   ├── ChatContainer.tsx    # 聊天容器
│   └── ChatSidebar.tsx      # 聊天侧边栏（复用 Sidebar）
└── index.ts

frontend/pages/Settings/
├── SettingsPage.tsx          # 设置页面（从模态框转换为页面）
├── components/
│   └── SettingsContainer.tsx
└── index.ts
```

#### 1.2 修改路由配置 (App.tsx)

**修改前:**
```typescript
<Routes>
  <Route path="/" element={<AppContent />} />
  <Route path="/session/:sessionId" element={<AppContent />} />
</Routes>
```

**修改后:**
```typescript
<Routes>
  {/* 公开路由 */}
  <Route path="/homepage" element={<Homepage />} />

  {/* 受保护路由 */}
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<ChatPage />} />
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/session/:sessionId" element={<ChatPage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Route>

  {/* 全局页面 */}
  <Route path="/onboarding" element={<OnboardingPage />} />
  <Route path="/error" element={<ErrorPage />} />
  <Route path="/404" element={<NotFoundPage />} />
</Routes>
```

#### 1.3 更新 ProtectedRoute 逻辑

**文件:** `frontend/router/ProtectedRoute.tsx`

**新增逻辑:**
- 未认证用户访问 "/" → 重定向到 "/homepage"
- 未认证用户访问 "/homepage" → 显示 Homepage
- 已认证用户访问 "/homepage" → 重定向到 "/chat"

#### 1.4 ChatPage 组件实施

**文件:** `frontend/pages/Chat/ChatPage.tsx`

**内容:**
```typescript
export function ChatPage() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar
        projects={...}
        selectedProject={...}
        selectedSession={...}
        // ... props
      />

      {/* Main Content */}
      <MainContent
        selectedProject={...}
        selectedSession={...}
        // ... props
      />
    </div>
  );
}
```

**迁移内容:**
- 从 App.tsx 提取 Sidebar 和 MainContent 部分
- 保留所有 WebSocket 连接逻辑
- 保留会话保护机制

#### 1.5 SettingsPage 组件实施

**文件:** `frontend/pages/Settings/SettingsPage.tsx`

**内容:**
```typescript
export function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <SettingsHeader />
      <SettingsTabs>
        <SettingsTab label="Agents">...</SettingsTab>
        <SettingsTab label="System">...</SettingsTab>
        <SettingsTab label="Profile">...</SettingsTab>
      </SettingsTabs>
    </div>
  );
}
```

**迁移内容:**
- 从 `features/settings/components/Settings.tsx` 提取内容
- 从模态框形式转换为全页面形式
- 保留所有设置选项和逻辑

**测试清单:**
```bash
✓ 访问 "/homepage" 显示首页（未登录）
✓ 访问 "/" 重定向到登录页（未登录）
✓ 登录后访问 "/" 显示聊天页面
✓ 访问 "/chat" 显示聊天页面
✓ 访问 "/settings" 显示设置页面
✓ 所有现有功能正常工作
✓ WebSocket 连接正常
✓ 会话保护机制正常
```

---

### 阶段 2: 国际化系统 (P0)

**目标:** 实现中英文双语支持

#### 2.1 安装依赖

```bash
npm install i18next react-i18next i18next-browser-languagedetector
npm install -D @types/i18next
```

#### 2.2 创建 i18n 配置

**文件:** `frontend/shared/i18n/index.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zh from './locales/zh.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, zh },
    fallbackLng: 'en',
    lng: localStorage.getItem('language') || 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
```

#### 2.3 创建翻译文件

**文件:** `frontend/shared/i18n/locales/en.json`

```json
{
  "common": {
    "login": "Login",
    "logout": "Logout",
    "settings": "Settings",
    "language": "Language"
  },
  "homepage": {
    "title": "Claude Code UI",
    "subtitle": "Multi-user Web Interface for AI Coding",
    "features": {
      "title": "Key Features",
      "chat": "Real-time Chat",
      "collaboration": "Team Collaboration",
      "multiModel": "Multi-Model Support"
    },
    "cta": {
      "login": "Get Started",
      "learnMore": "Learn More"
    }
  },
  "chat": {
    "newSession": "New Session",
    "send": "Send",
    "attachFile": "Attach File"
  },
  "settings": {
    "agents": "Agents",
    "system": "System",
    "profile": "Profile"
  }
}
```

**文件:** `frontend/shared/i18n/locales/zh.json`

```json
{
  "common": {
    "login": "登录",
    "logout": "退出登录",
    "settings": "设置",
    "language": "语言"
  },
  "homepage": {
    "title": "Claude Code UI",
    "subtitle": "AI 编码的多用户 Web 界面",
    "features": {
      "title": "核心功能",
      "chat": "实时聊天",
      "collaboration": "团队协作",
      "multiModel": "多模型支持"
    },
    "cta": {
      "login": "开始使用",
      "learnMore": "了解更多"
    }
  },
  "chat": {
    "newSession": "新会话",
    "send": "发送",
    "attachFile": "附加文件"
  },
  "settings": {
    "agents": "代理",
    "system": "系统",
    "profile": "个人资料"
  }
}
```

#### 2.4 创建语言切换 Hook

**文件:** `frontend/shared/hooks/useLanguage.ts`

```typescript
import { useTranslation } from 'react-i18next';

export function useLanguage() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const currentLanguage = i18n.language;

  return {
    currentLanguage,
    changeLanguage,
    isEnglish: currentLanguage === 'en',
    isChinese: currentLanguage === 'zh',
  };
}
```

#### 2.5 创建语言切换按钮

**文件:** `frontend/shared/components/common/LanguageSwitcher.tsx`

```typescript
import { useLanguage } from '@/shared/hooks/useLanguage';

export function LanguageSwitcher() {
  const { currentLanguage, changeLanguage } = useLanguage();

  return (
    <button
      onClick={() => changeLanguage(currentLanguage === 'en' ? 'zh' : 'en')}
      className="px-3 py-1 rounded-md border hover:bg-accent"
    >
      {currentLanguage === 'en' ? '中文' : 'EN'}
    </button>
  );
}
```

#### 2.6 在 App.tsx 中集成 i18n

**修改:** `frontend/App.tsx`

```typescript
import '@/shared/i18n'; // 导入 i18n 配置

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          {/* ... existing providers ... */}
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

**测试清单:**
```bash
✓ 语言切换按钮正常工作
✓ 切换语言后界面立即更新
✓ 刷新页面后语言设置保持
✓ 所有文本都有翻译
✓ localStorage 正确保存语言偏好
```

---

### 阶段 3: 首页创建 (P0)

**目标:** 创建产品介绍落地页

#### 3.1 Homepage 组件结构

**文件:** `frontend/pages/Homepage/Homepage.tsx`

```typescript
import { useTranslation } from 'react-i18next';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { CTAButton } from './components/CTAButton';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';

export function Homepage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 w-full bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold">Claude Code UI</div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <CTAButton variant="outline" to="/login">
              {t('common.login')}
            </CTAButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* CTA Section */}
      <section className="py-20 bg-accent/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            {t('homepage.cta.title')}
          </h2>
          <CTAButton to="/login">
            {t('homepage.cta.login')}
          </CTAButton>
        </div>
      </section>
    </div>
  );
}
```

#### 3.2 HeroSection 组件

**文件:** `frontend/pages/Homepage/components/HeroSection.tsx`

```typescript
import { useTranslation } from 'react-i18next';
import { CTAButton } from './CTAButton';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-6">
          {t('homepage.title')}
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          {t('homepage.subtitle')}
        </p>
        <CTAButton to="/login" size="lg">
          {t('homepage.cta.login')}
        </CTAButton>
      </div>
    </section>
  );
}
```

#### 3.3 FeaturesSection 组件

**文件:** `frontend/pages/Homepage/components/FeaturesSection.tsx`

```typescript
import { useTranslation } from 'react-i18next';

const features = [
  { key: 'chat', icon: '💬', description: 'Real-time AI chat interface' },
  { key: 'collaboration', icon: '👥', description: 'Multi-user collaboration' },
  { key: 'multiModel', icon: '🤖', description: 'Claude, Cursor, Codex support' },
  { key: 'fileManager', icon: '📁', description: 'Integrated file explorer' },
  { key: 'terminal', icon: '⚡', description: 'Web-based terminal' },
  { key: 'tasks', icon: '✅', description: 'Task management system' },
];

export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t('homepage.features.title')}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map(feature => (
            <div key={feature.key} className="p-6 bg-card rounded-lg">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">
                {t(`homepage.features.${feature.key}`)}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

#### 3.4 更新路由

**修改:** `frontend/App.tsx`

```typescript
<Routes>
  {/* 公开路由 */}
  <Route path="/homepage" element={<Homepage />} />
  <Route path="/login" element={<LoginForm />} />

  {/* 受保护路由 */}
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<ChatPage />} />
    {/* ... */}
  </Route>
</Routes>
```

**测试清单:**
```bash
✓ 访问 "/homepage" 显示完整首页
✓ Hero Section 显示正确
✓ Features Section 显示所有功能卡片
✓ CTA 按钮跳转到登录页
✓ 语言切换按钮正常工作
✓ 响应式布局在移动端正常
```

---

### 阶段 4: 用户菜单增强 (P0)

**目标:** 在头部显示用户昵称和下拉菜单

#### 4.1 创建 UserAvatar 组件

**文件:** `frontend/shared/components/common/UserAvatar.tsx`

```typescript
import { useAuth } from '@/shared/contexts/AuthContext';

interface UserAvatarProps {
  onClick?: () => void;
}

export function UserAvatar({ onClick }: UserAvatarProps) {
  const { user } = useAuth();

  const initial = user?.name?.[0] || user?.email?.[0] || 'U';

  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold hover:bg-primary/90 transition-colors"
    >
      {initial}
    </button>
  );
}
```

#### 4.2 创建 UserDropdown 组件

**文件:** `frontend/shared/components/common/UserDropdown.tsx`

```typescript
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/shared/contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { Settings, LogOut } from 'lucide-react';

export function UserDropdown() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <UserAvatar onClick={() => setIsOpen(!isOpen)} />

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-popover border rounded-md shadow-lg">
          {/* User Info */}
          <div className="px-4 py-3 border-b">
            <p className="font-semibold">{user?.name || 'User'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                window.location.href = '/settings';
              }}
              className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {t('common.settings')}
            </button>

            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2 text-destructive"
            >
              <LogOut className="w-4 h-4" />
              {t('common.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 4.3 创建 AppHeader 组件

**文件:** `frontend/shared/components/layout/AppHeader.tsx`

```typescript
import { UserDropdown } from '@/shared/components/common/UserDropdown';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import { useAuth } from '@/shared/contexts/AuthContext';

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      {/* Left: Mobile Menu Button */}
      <button onClick={onMenuClick} className="md:hidden">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Center: Title/Logo (optional) */}
      <div className="flex-1" />

      {/* Right: Language + User Menu */}
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        {user && <UserDropdown />}
      </div>
    </header>
  );
}
```

#### 4.4 集成到 ChatPage

**修改:** `frontend/pages/Chat/ChatPage.tsx`

```typescript
import { AppHeader } from '@/shared/components/layout/AppHeader';

export function ChatPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <AppHeader onMenuClick={() => setSidebarOpen(true)} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar /* ... */ />
        <MainContent /* ... */ />
      </div>
    </div>
  );
}
```

**测试清单:**
```bash
✓ 头部显示用户头像（昵称首字母）
✓ 点击头像显示下拉菜单
✓ 下拉菜单显示用户信息
✓ 点击设置跳转到 /settings
✓ 点击退出登出并跳转到 /homepage
✓ 语言切换按钮在头部显示
✓ 移动端菜单按钮显示
```

---

## 三、实施顺序

### 推荐执行顺序

1. **阶段 1 (页面架构)** - 3-4天
   - 创建页面目录结构
   - 实现基础路由
   - 迁移 Chat 和 Settings 到独立页面

2. **阶段 2 (国际化)** - 2-3天
   - 安装配置 i18next
   - 创建翻译文件
   - 实现语言切换

3. **阶段 3 (首页)** - 2天
   - 创建 Homepage 组件
   - 实现各个 Section
   - 集成到路由

4. **阶段 4 (用户菜单)** - 1-2天
   - 创建 UserAvatar 和 UserDropdown
   - 创建 AppHeader
   - 集成到各个页面

**总预计时间:** 8-11天

### 依赖关系

```
阶段1 (页面架构)
    ↓
阶段2 (国际化) ← 阶段3 (首页) ← 阶段4 (用户菜单)
```

- 阶段 1 必须首先完成，是其他阶段的基础
- 阶段 2 应该在阶段 3、4 之前完成（首页和用户菜单需要翻译）
- 阶段 3 和 4 可以并行开发

---

## 四、风险与缓解

### 风险 1: 现有功能破坏

**风险等级:** 高

**缓解措施:**
- 使用 Git 分支进行开发
- 每个阶段完成后进行完整测试
- 保留原有 App.tsx 作为回退点
- 使用 feature flag 控制新功能

### 风险 2: 翻译遗漏

**风险等级:** 中

**缓解措施:**
- 创建 TypeScript 类型检查翻译键
- 使用脚本检测未翻译的文本
- 分阶段迁移，优先核心页面

### 风险 3: 性能影响

**风险等级:** 低

**缓解措施:**
- 使用 React.lazy() 进行代码分割
- 翻译文件按需加载
- 图片资源优化

---

## 五、测试策略

### 单元测试

```bash
# 组件测试
frontend/pages/__tests__/
├── ChatPage.test.tsx
├── SettingsPage.test.tsx
├── Homepage.test.tsx
└── UserDropdown.test.tsx

# Hook 测试
frontend/shared/hooks/__tests__/
└── useLanguage.test.ts
```

### 集成测试

```bash
# 路由测试
frontend/router/__tests__/
└── routes.test.tsx

# 认证流程测试
frontend/features/auth/__tests__/
└── auth-flow.test.tsx
```

### E2E 测试清单

```bash
# 首页测试
✓ 访问根路径显示首页（未登录）
✓ 点击登录按钮跳转到登录页
✓ 语言切换正常工作
✓ 响应式布局正常

# 聊天页面测试
✓ 登录后显示聊天页面
✓ 侧边栏正常显示
✓ 创建新会话正常
✓ WebSocket 连接正常
✓ 用户菜单显示和操作正常

# 设置页面测试
✓ 访问 /settings 显示设置页面
✓ 所有设置选项可用
✓ 保存设置正常

# 用户菜单测试
✓ 显示用户头像
✓ 下拉菜单显示正确
✓ 退出登录功能正常
✓ 跳转到设置页面正常
```

---

## 六、文件清单

### 新增文件

```
frontend/pages/Homepage/
├── Homepage.tsx
├── components/
│   ├── HeroSection.tsx
│   ├── FeaturesSection.tsx
│   └── CTAButton.tsx
├── types/
│   └── homepage.types.ts
└── index.ts

frontend/pages/Chat/
├── ChatPage.tsx
├── components/
│   ├── ChatContainer.tsx
│   └── ChatSidebar.tsx
└── index.ts

frontend/pages/Settings/
├── SettingsPage.tsx
├── components/
│   └── SettingsContainer.tsx
└── index.ts

frontend/shared/i18n/
├── index.ts
├── locales/
│   ├── en.json
│   └── zh.json

frontend/shared/components/common/
├── LanguageSwitcher.tsx
├── UserAvatar.tsx
└── UserDropdown.tsx

frontend/shared/components/layout/
└── AppHeader.tsx

frontend/shared/hooks/
└── useLanguage.ts
```

### 修改文件

```
frontend/App.tsx                          # 更新路由配置
frontend/router/ProtectedRoute.tsx        # 更新认证逻辑
frontend/features/settings/components/Settings.tsx  # 内容迁移到 SettingsPage
```

---

## 七、验证标准

### 功能验证

```bash
# 页面路由
✓ 所有路由可访问
✓ 认证保护正常工作
✓ 重定向逻辑正确

# 国际化
✓ 语言切换即时生效
✓ 所有文本有翻译
✓ 语言偏好持久化

# 首页
✓ 所有区块显示正确
✓ CTA 按钮功能正常
✓ 响应式布局正常

# 用户菜单
✓ 用户信息显示正确
✓ 下拉菜单功能正常
✓ 退出登录流程正确
```

### 性能验证

```bash
# 构建大小
✓ 首次加载 < 500KB (gzipped)
✓ 代码分割正常工作
✓ 翻译文件按需加载

# 运行时性能
✓ FCP < 1.5s
✓ TTI < 3.5s
✓ 无内存泄漏
```

### 兼容性验证

```bash
# 浏览器
✓ Chrome (最新版)
✓ Firefox (最新版)
✓ Safari (最新版)
✓ Edge (最新版)

# 设备
✓ Desktop (1920x1080)
✓ Tablet (768x1024)
✓ Mobile (375x667)
```

---

## 八、后续优化

### Phase 2 功能

1. **用户资料编辑**
   - 头像上传
   - 昵称修改
   - 偏好设置

2. **主题系统**
   - 暗色模式优化
   - 自定义主题色

3. **更多语言**
   - 日语
   - 韩语
   - 西班牙语

### 性能优化

1. **SSR/SSG**
   - 使用 Next.js 重构
   - 静态生成首页

2. **PWA 增强**
   - 离线支持
   - 安装提示

---

## 九、总结

本计划提供了完整的实施路径，从页面架构重构到国际化、首页和用户菜单的实现。关键成功因素包括：

1. **渐进式迁移** - 保持现有功能稳定的同时添加新功能
2. **充分测试** - 每个阶段完成后进行验证
3. **用户反馈** - 及时收集和响应用户意见
4. **文档更新** - 保持代码和文档同步

**预期成果:**
- ✅ 标准化的多页面应用架构
- ✅ 完整的中英文双语支持
- ✅ 吸引人的产品首页
- ✅ 便捷的用户菜单系统
- ✅ 为未来扩展打下坚实基础
