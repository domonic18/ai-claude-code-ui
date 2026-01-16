/**
 * TasksTab Component
 *
 * Handles Tasks settings.
 *
 * Features:
 * - TaskMaster installation status check
 * - Enable/disable TaskMaster integration
 * - Installation instructions when TaskMaster is not installed
 *
 * This component wraps the existing TasksSettings component.
 */

import React from 'react';
import TasksSettings from '../../../components/TasksSettings';

interface TasksTabProps {
  // Props passed from parent Settings if needed
  // Currently self-contained
}

/**
 * TasksTab Component - Manages TaskMaster integration settings
 */
export function TasksTab({}: TasksTabProps) {
  return (
    <div className="space-y-6 md:space-y-8">
      <TasksSettings />
    </div>
  );
}

export default TasksTab;
