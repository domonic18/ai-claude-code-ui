/**
 * SimplifiedToolIndicator（Skill 分支）测试
 *
 * 覆盖：技能名解析与展示、失败结果 ⚠、坏 JSON / 缺字段安全返回、
 * Read 分支不受新 props 影响。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { SimplifiedToolIndicator } from '../SimplifiedToolIndicator';

afterEach(cleanup);

describe('SimplifiedToolIndicator - Skill', () => {
  it('渲染一行"已加载技能"+ 技能名', () => {
    render(
      <SimplifiedToolIndicator
        toolName="Skill"
        toolInput={JSON.stringify({ skill: 'patent-docx-opinions-review' })}
      />
    );
    expect(screen.getByText('已加载技能')).toBeInTheDocument();
    expect(screen.getByText('patent-docx-opinions-review')).toBeInTheDocument();
  });

  it('失败结果（isError）显示"技能加载失败"与 ⚠', () => {
    render(
      <SimplifiedToolIndicator
        toolName="Skill"
        toolInput={JSON.stringify({ skill: 'some-skill' })}
        toolResult={{ content: 'Unknown skill', isError: true }}
      />
    );
    expect(screen.getByText('技能加载失败')).toBeInTheDocument();
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('坏 JSON 安全返回空', () => {
    const { container } = render(
      <SimplifiedToolIndicator toolName="Skill" toolInput="{broken" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('缺少 skill 字段安全返回空', () => {
    const { container } = render(
      <SimplifiedToolIndicator toolName="Skill" toolInput={JSON.stringify({ args: 'x' })} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('SimplifiedToolIndicator - Read（回归）', () => {
  it('仍按文件名渲染，不受新增 toolResult prop 影响', () => {
    render(
      <SimplifiedToolIndicator
        toolName="Read"
        toolInput={JSON.stringify({ file_path: '/workspace/docs/申请文件.docx' })}
        toolResult={{ content: 'ok', isError: false }}
      />
    );
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('申请文件.docx')).toBeInTheDocument();
  });

  it('TodoWrite 不再走简化指示器（返回空，改由聚合卡渲染）', () => {
    const { container } = render(
      <SimplifiedToolIndicator
        toolName="TodoWrite"
        toolInput={JSON.stringify({ todos: [{ content: 'A', status: 'pending' }] })}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
