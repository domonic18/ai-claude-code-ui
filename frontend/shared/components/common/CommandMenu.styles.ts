/**
 * Styles for CommandMenu component
 */

export const menuContainerStyle = {
  borderRadius: '8px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  zIndex: 1000,
  transition: 'opacity 150ms ease-in-out, transform 150ms ease-in-out'
} as const;

export const menuContentStyle = {
  maxHeight: '300px',
  overflowY: 'auto',
  padding: '8px'
} as const;

export const emptyMenuStyle = {
  ...menuContainerStyle,
  maxHeight: '300px',
  padding: '20px',
  opacity: 1,
  transform: 'translateY(0)' as const,
  textAlign: 'center' as const
};

export const groupHeaderStyle = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  color: '#6b7280',
  padding: '8px 12px 4px',
  letterSpacing: '0.05em'
};

export const commandItemStyle = {
  display: 'flex' as const,
  alignItems: 'flex-start' as const,
  padding: '10px 12px',
  borderRadius: '6px',
  cursor: 'pointer' as const,
  transition: 'background-color 100ms ease-in-out',
  marginBottom: '2px'
};

export const commandItemContentStyle = {
  flex: 1,
  minWidth: 0
};

export const commandNameRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

export const commandIconStyle = {
  fontSize: '16px',
  flexShrink: 0
};

export const commandNameStyle = {
  fontWeight: 600,
  fontSize: '14px',
  color: '#111827',
  fontFamily: 'monospace'
};

export const commandMetadataBadgeStyle = {
  fontSize: '10px',
  padding: '2px 6px',
  borderRadius: '4px',
  backgroundColor: '#f3f4f6',
  color: '#6b7280',
  fontWeight: 500
};

export const commandDescStyle = {
  fontSize: '13px',
  color: '#6b7280',
  marginLeft: '24px',
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

export const selectedIndicatorStyle = {
  marginLeft: '8px',
  color: '#3b82f6',
  fontSize: '12px',
  fontWeight: 600
};

export const namespaceLabels: Record<string, string> = {
  frequent: '⭐ Frequently Used',
  builtin: 'Built-in Commands',
  project: 'Project Commands',
  user: 'User Commands',
  other: 'Other Commands'
};

export const namespaceIcons: Record<string, string> = {
  builtin: '⚡',
  project: '📁',
  user: '👤',
  other: '📝'
};

export const commandMenuCSS = `
  .command-menu {
    background-color: white;
    border: 1px solid #e5e7eb;
  }
  .command-menu-empty {
    color: #6b7280;
  }

  @media (prefers-color-scheme: dark) {
    .command-menu {
      background-color: #1f2937 !important;
      border: 1px solid #374151 !important;
    }
    .command-menu-empty {
      color: #9ca3af !important;
    }
    .command-item[aria-selected="true"] {
      background-color: #1e40af !important;
    }
    .command-item span:not(.command-metadata-badge) {
      color: #f3f4f6 !important;
    }
    .command-metadata-badge {
      background-color: #f3f4f6 !important;
      color: #6b7280 !important;
    }
    .command-item div {
      color: #d1d5db !important;
    }
    .command-group > div:first-child {
      color: #9ca3af !important;
    }
  }
`;
