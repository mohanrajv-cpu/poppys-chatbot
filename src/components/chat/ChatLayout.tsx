'use client';

import { useState } from 'react';
import { User } from '@/types';
import Sidebar from './Sidebar';

export default function ChatLayout({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-[260px]' : 'w-0'
        } transition-all duration-300 overflow-hidden flex-shrink-0`}
      >
        <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-gray-100 flex items-center px-4 gap-3 flex-shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Open sidebar"
            >
              <svg
                className="w-5 h-5 text-[#155387]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#787878]">{user.name}</span>
            <span className="text-xs px-2 py-0.5 bg-[#b8dfff] text-[#155387] rounded-full font-medium">
              {user.role === 'po_creator'
                ? 'PO Creator'
                : user.role === 'colour_manager'
                ? 'Colour Manager'
                : 'PO Approver'}
            </span>
          </div>
        </header>

        {/* Chat Content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
