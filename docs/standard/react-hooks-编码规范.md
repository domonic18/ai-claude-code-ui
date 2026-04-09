# React Hooks 编码规范

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0.0 |
| 创建日期 | 2026-04-09 |
| 适用范围 | Claude Code UI 前端代码 |
| 背景 | 2026-03-24、03-27 连续出现两次闭包引用错误，需从规范层面杜绝此类问题 |

---

## 1. 问题背景

React 函数组件中，回调函数会捕获创建时的状态值（闭包）。当状态更新后，旧的回调函数仍然引用旧值，导致 bug。这类问题难以通过肉眼发现，需要通过编码规范和工具检测来预防。

**本项目出现过的典型错误：**

```typescript
// Bug：setState 内部引用了闭包中的 attachedFiles，而非使用 prev 参数
const handleAddFile = useCallback((file) => {
  setAttachedFiles(prev => {
    const existingIndex = attachedFiles.findIndex(f => f.id === file.id);
    //                   ^^^^^^^^^^^^^^ 过期值，应该用 prev
    ...
  });
}, [attachedFiles]); // 依赖项包含状态变量，每次渲染都重建函数
```

---

## 2. 核心规则

### 规则 1：setState 必须使用函数式更新

当 `setState` 调用中需要引用当前状态值时，**必须**使用 `prev =>` 参数，**禁止**从闭包中读取。

```typescript
// ❌ 错误：从闭包读取 attachedFiles
const handleAddFile = useCallback((file) => {
  setAttachedFiles([...attachedFiles, file]);
}, [attachedFiles]);

// ✅ 正确：使用 prev 参数，依赖项为空
const handleAddFile = useCallback((file) => {
  setAttachedFiles(prev => [...prev, file]);
}, []);
```

**判断标准：** 凡是在 `setState` 内部需要"当前值"的，一律用 `prev`。

### 规则 2：Observer / Timer / Event Listener 回调必须用 useRef 中转

`IntersectionObserver`、`WebSocket`、`setInterval`、`addEventListener` 等回调在创建后不会自动更新闭包。必须通过 `useRef` 中转以获取最新引用。

```typescript
// ❌ 错误：Observer 回调捕获了过期的 onLoadMore
const observer = new IntersectionObserver(() => {
  onLoadMore(); // 过期引用
});

// ✅ 正确：通过 ref 始终调用最新函数
const callbackRef = useRef(onLoadMore);
useEffect(() => { callbackRef.current = onLoadMore; }, [onLoadMore]);

const observer = new IntersectionObserver(() => {
  callbackRef.current();
});
```

### 规则 3：警惕依赖项中每次渲染都变的引用

数组、对象解构默认值、内联函数等每次渲染都会创建新引用，如果出现在 `useEffect` / `useCallback` 的依赖项中，会导致无限循环或缓存失效。

```typescript
// ❌ 错误：解构默认值每次渲染创建新数组
const { messages = [] } = props;
useEffect(() => { processMessages(messages); }, [messages]);

// ✅ 正确：用 useMemo 稳定引用
const EMPTY_MESSAGES: ChatMessage[] = [];
const stableMessages = useMemo(() => messages ?? EMPTY_MESSAGES, [messages]);
useEffect(() => { processMessages(stableMessages); }, [stableMessages]);
```

---

## 3. Code Review 检查项

审查 React 前端代码时，重点检查以下内容：

| # | 检查项 | 正确做法 |
|---|--------|----------|
| 1 | `setState` 中引用了当前状态值？ | 必须用 `prev =>` 函数式更新 |
| 2 | `useCallback` / `useEffect` 的依赖项是否合理？ | 不多不少，不含每次渲染都变的引用 |
| 3 | Observer / Timer / Event Listener 回调是否直接引用 state？ | 必须用 `useRef` 中转 |
| 4 | 组件间传递的回调 prop 是否稳定？ | 用 `useCallback` 包装，依赖项正确 |
| 5 | props 解构默认值是否稳定？ | 数组/对象默认值用 `useMemo` 或模块级常量 |

---

## 4. 工具检测

项目应配置 `eslint-plugin-react-hooks`，启用 `react-hooks/exhaustive-deps` 规则（error 级别）。该规则能自动检测上述大部分问题。

检测命令：`npm run lint`

---

## 5. 参考资料

- [React 官方文档 - 闭包陷阱](https://react.dev/learn/referencing-values-with-refs)
- [React 官方文档 - useEffect 依赖项](https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed)
- [React Hooks 闭包陷阱详解](https://react.dev/learn/state-as-a-snapshot)
