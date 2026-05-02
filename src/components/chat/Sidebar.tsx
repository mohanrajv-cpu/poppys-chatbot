'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, Conversation } from '@/types';

export default function Sidebar({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchConversations();
  }, []);

  async function fetchConversations() {
    try {
      const res = await fetch('/api/chat?action=list');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // Silently fail — conversations will show empty
    }
  }

  async function handleNewChat() {
    router.push('/');
  }

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  }

  // Group conversations by date
  function groupByDate(convos: Conversation[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const lastWeek = new Date(today.getTime() - 7 * 86400000);

    const groups: { label: string; items: Conversation[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Last 7 days', items: [] },
      { label: 'Older', items: [] },
    ];

    for (const c of convos) {
      const date = new Date(c.created_at);
      if (date >= today) groups[0].items.push(c);
      else if (date >= yesterday) groups[1].items.push(c);
      else if (date >= lastWeek) groups[2].items.push(c);
      else groups[3].items.push(c);
    }

    return groups.filter((g) => g.items.length > 0);
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupByDate(filtered);

  return (
    <div className="h-full bg-[#155387] text-white flex flex-col">
      {/* Logo + Close */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-[#155387] font-bold text-sm">P</span>
          </div>
          <span className="font-semibold text-sm">Poppys</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="Close sidebar"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 mb-3">
        <button
          onClick={handleNewChat}
          className="w-full py-2.5 px-4 border border-white/30 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm placeholder-white/50 focus:outline-none focus:border-white/40"
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        {grouped.length === 0 && (
          <p className="text-white/50 text-xs text-center mt-8 px-4">
            Your conversations will appear here. Start by clicking + New chat.
          </p>
        )}
        {grouped.map((group) => (
          <div key={group.label} className="mb-4">
            <h3 className="text-xs font-medium text-white/50 px-2 mb-1">
              {group.label}
            </h3>
            {group.items.map((conv) => (
              <button
                key={conv.id}
                onClick={() => router.push(`/${conv.id}`)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-white/10 transition-colors ${
                  pathname === `/${conv.id}` ? 'bg-white/15' : ''
                }`}
              >
                {conv.title}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Admin Links */}
      <div className="px-3 mb-2 space-y-1">
        <button
          onClick={() => router.push('/admin/notifications')}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${
            pathname === '/admin/notifications' ? 'bg-white/15' : ''
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Notifications
        </button>
        {user.role === 'colour_manager' && (
          <button
            onClick={() => router.push('/admin/colours')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${
              pathname === '/admin/colours' ? 'bg-white/15' : ''
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Colour Bank
          </button>
        )}
        {user.role === 'po_approver' && (
          <button
            onClick={() => router.push('/admin/approvals')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${
              pathname === '/admin/approvals' ? 'bg-white/15' : ''
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            PO Approvals
          </button>
        )}
      </div>

      {/* User + Logout */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm truncate">{user.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Sign out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
