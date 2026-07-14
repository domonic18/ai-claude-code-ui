/**
 * DocumentItem error 态组件测试
 *
 * 验证摘要生成失败时的 UI 入口：
 * - 展示「摘要生成失败」+「重新生成」+「手动填写」按钮
 * - 「重新生成」点击触发 onRegenerateSummary，source 从 doc.type 推导
 * - 「手动填写」进入编辑，textarea 初始为空（error 态预填空串）
 *
 * @module features/documents/components/__tests__/DocumentItem.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DocumentItem } from '../DocumentItem';
import type { DocumentItem as DocumentItemType } from '../../types/document.types';

// 每个测试后清理 DOM，避免累积导致 getByText 找到多个元素
afterEach(() => {
  cleanup();
});

/** 构造一个 error 态上传文档 */
function makeErrorDoc(overrides: Partial<DocumentItemType> = {}): DocumentItemType {
  return {
    file_name: 'bad.pdf',
    file_path: '/p/bad.pdf',
    file_size: 100,
    type: 'upload',
    summary_status: 'error',
    summary: '（摘要生成失败，请手动编辑）',
    ...overrides,
  };
}

describe('DocumentItem error 态', () => {
  it('展示「摘要生成失败」+「重新生成」+「手动填写」按钮', () => {
    render(
      <DocumentItem
        doc={makeErrorDoc()}
        onPreview={vi.fn()}
        onDelete={vi.fn()}
        onEditSummary={vi.fn()}
        onRegenerateSummary={vi.fn()}
      />,
    );
    expect(screen.getByText('摘要生成失败')).toBeInTheDocument();
    expect(screen.getByText('重新生成')).toBeInTheDocument();
    expect(screen.getByText('手动填写')).toBeInTheDocument();
  });

  it('点击「重新生成」触发 onRegenerateSummary（source 从 type 推导）', () => {
    const onRegenerate = vi.fn();
    render(
      <DocumentItem
        doc={makeErrorDoc({ type: 'ai_generated' })}
        onPreview={vi.fn()}
        onDelete={vi.fn()}
        onEditSummary={vi.fn()}
        onRegenerateSummary={onRegenerate}
      />,
    );
    fireEvent.click(screen.getByText('重新生成'));
    expect(onRegenerate).toHaveBeenCalledWith('/p/bad.pdf', 'bad.pdf', 'ai');
  });

  it('点击「手动填写」进入编辑，textarea 初始为空（error 态预填空串）', () => {
    render(
      <DocumentItem
        doc={makeErrorDoc()}
        onPreview={vi.fn()}
        onDelete={vi.fn()}
        onEditSummary={vi.fn()}
        onRegenerateSummary={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('手动填写'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });
});
