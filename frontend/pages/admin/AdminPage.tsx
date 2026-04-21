/**
 * Admin Page Component
 *
 * Admin interface for managing platform extensions and settings.
 *
 * @module pages/Admin
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { ExtensionManagement } from '@/features/admin';

/**
 * Admin Page Component
 */
export function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <Link
              to="/chat"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">返回聊天</span>
            </Link>

            {/* Title */}
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">管理控制台</h1>
            </div>

            {/* Spacer for balance */}
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto">
        <ExtensionManagement />
      </main>
    </div>
  );
}

export default AdminPage;
