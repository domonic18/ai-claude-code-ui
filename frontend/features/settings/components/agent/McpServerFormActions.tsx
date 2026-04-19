/**
 * McpServerFormActions Component
 *
 * Form action buttons (Cancel and Submit).
 */

import React from 'react';
import { Button } from '@/shared/components/ui/Button';

export interface McpServerFormActionsProps {
  loading: boolean;
  editingServer: boolean;
  onClose: () => void;
}

/**
 * McpServerFormActions - Form submit and cancel buttons
 */
export const McpServerFormActions: React.FC<McpServerFormActionsProps> = ({
  loading,
  editingServer,
  onClose
}) => {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={loading}
        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : (editingServer ? 'Update Server' : 'Add Server')}
      </Button>
    </div>
  );
};

export default McpServerFormActions;
