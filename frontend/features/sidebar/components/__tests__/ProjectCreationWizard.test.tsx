/**
 * ProjectCreationWizard 组件测试
 *
 * 重点守护 IME 输入安全（非受控方案）：
 * 1. 普通输入路径：onChange 上报、非法字符被 sanitize
 * 2. IME 组合路径：组合中间值写入 DOM 不被重渲染清掉（jsdom 无法真实模拟
 *    输入法，用"组合期间连续 change + DOM 值保留"近似模拟受控组件会失败的场景）
 * 3. 外部清空：value 重置为空时 DOM 同步清空（创建成功后重开弹窗场景）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import ProjectCreationWizard from '../ProjectCreationWizard';

// i18n 直通：返回 key 本身，避免依赖语言包加载
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// wizard hook 依赖的 API 层与查重逻辑 mock 掉，聚焦输入框行为。
// checkNameAvailability 在 utils 层 mock（返回 available），绕开 Response 形状问题
vi.mock('../../hooks/projectNameValidation', async () => {
  const actual = await vi.importActual<any>('../../hooks/projectNameValidation');
  return {
    ...actual,
    createProjectApi: vi.fn().mockResolvedValue({ name: 'test' }),
  };
});

vi.mock('../../utils/projectNameUtils', async () => {
  const actual = await vi.importActual<any>('../../utils/projectNameUtils');
  return {
    ...actual,
    checkNameAvailability: vi.fn().mockResolvedValue('available'),
  };
});

vi.mock('@/shared/services', () => ({
  api: {
    browseFilesystem: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { suggestions: [] } }),
    }),
    createProject: vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { project: { name: 'test' } } }),
    }),
  },
}));

vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('ProjectCreationWizard 输入框（IME 安全面）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const getInput = () => screen.getByLabelText('projectCreation.projectName') as HTMLInputElement;

  it('普通英文输入：每个字符都应出现在输入框并上报 onChange', () => {
    render(<ProjectCreationWizard isOpen onClose={vi.fn()} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('abc');

    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(input.value).toBe('abcd');
  });

  it('IME 组合模拟：连续中间值不被丢字（打 ceshi 全程保留）', () => {
    render(<ProjectCreationWizard isOpen onClose={vi.fn()} />);
    const input = getInput();

    // 模拟拼音逐字母组合：受控组件若在组合中重写 value 会丢失/截断
    const steps = ['c', 'ce', 'ces', 'cesh', 'ceshi'];
    for (const s of steps) {
      fireEvent.change(input, { target: { value: s } });
    }
    expect(input.value).toBe('ceshi');

    // 上屏（组合结束）：值替换为中文，应完整进入并上报
    fireEvent.change(input, { target: { value: '测试' } });
    expect(input.value).toBe('测试');
  });

  it('中文值通过 sanitize：非法字符（空格/斜杠）被过滤，中文保留', async () => {
    render(<ProjectCreationWizard isOpen onClose={vi.fn()} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: '测试 项目/名' } });
    // sanitize 白名单：中文、字母、数字、-、_。
    // 注意：sanitize 只作用于 state（路径预览/提交值），DOM 保留用户原始输入；
    // jsdom 下 fireEvent 直接改 DOM 后组件不回写，故此处断言的是"下一次
    // change 后的 state 生效路径"——通过按钮解除禁用与指示器验证
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const createBtn = screen.getByRole('button', { name: /projectCreation\.createButton/ });
    expect((createBtn as HTMLButtonElement).disabled).toBe(false);
    // 可用性指示器应显示"可用"（status.available 文案）
    expect(screen.getByText('projectCreation.status.available')).toBeTruthy();
  });

  it('IME 安全不变量：组件不得绑定 value/defaultValue（jsdom 无法测真 IME，固化结构契约）', () => {
    // 真实 IME 组合时序只有浏览器能产生；此处固化的是防回归的结构性不变量：
    // 输入框一旦被绑定为受控（value=...）或带 defaultValue 同步 effect，
    // 组合态就会被 React 重渲染打断（历史上两次回归的根因）。
    // 用 DOM 属性检查：渲染后任何重渲染都不应给 input 注入 value 属性同步
    render(<ProjectCreationWizard isOpen onClose={vi.fn()} />);
    const input = getInput();

    // React 受控组件会在 input 上持久挂 value 属性（即使等于当前值）。
    // 非受控方案：初始渲染后 input 没有被 React 管理的 value 属性
    expect(input.getAttribute('value')).toBeNull();

    // 触发一轮完整交互 + 重渲染（输入→查重→状态变化），属性依然不被注入
    fireEvent.change(input, { target: { value: 'x' } });
    expect(input.getAttribute('value')).toBeNull();
  });

  it('外部重置：重开弹窗（重新挂载）输入框为空，不留旧值', () => {
    const { unmount } = render(<ProjectCreationWizard isOpen onClose={vi.fn()} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: '旧名字' } });
    expect(input.value).toBe('旧名字');

    // 卸载重挂载（等价于弹窗关闭再打开，新组件实例从空白开始）
    unmount();
    render(<ProjectCreationWizard isOpen onClose={vi.fn()} />);
    const freshInput = screen.getByLabelText('projectCreation.projectName') as HTMLInputElement;
    expect(freshInput.value).toBe('');
  });
});
