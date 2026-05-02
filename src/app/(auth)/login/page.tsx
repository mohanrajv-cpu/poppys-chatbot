'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TEST_USERS = [
  {
    name: 'Priya',
    role: 'po_creator' as const,
    label: 'PO Creator',
    description: 'Creates POs, validates colours, uploads PDFs',
    color: '#3BA6FF',
    icon: 'P',
  },
  {
    name: 'Kavitha',
    role: 'colour_manager' as const,
    label: 'Colour Bank Manager',
    description: 'Approves or rejects new colours added to the bank',
    color: '#7944AB',
    icon: 'K',
  },
  {
    name: 'Rajan',
    role: 'po_approver' as const,
    label: 'PO Approver',
    description: 'Reviews and approves submitted POs',
    color: '#348734',
    icon: 'R',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  async function handleDemoLogin(role: string) {
    setError('');
    setLoadingRole(role);

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoadingRole(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#b8dfff] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#155387] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-[#155387]">Poppys Chatbot</h1>
          <p className="text-[#787878] mt-1">PO Colour Validation System</p>
        </div>

        {/* Demo label */}
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 bg-[#FFFA91] text-[#826D01] text-xs font-medium rounded-full">
            DEMO MODE
          </span>
          <p className="text-sm text-[#787878] mt-2">
            Click a test user to sign in instantly
          </p>
        </div>

        {/* Test User Cards */}
        <div className="space-y-3">
          {TEST_USERS.map((user) => (
            <button
              key={user.role}
              onClick={() => handleDemoLogin(user.role)}
              disabled={loadingRole !== null}
              className="w-full text-left border-2 border-gray-100 rounded-xl p-4 hover:border-[#3ba6ff] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                  style={{ backgroundColor: user.color }}
                >
                  {user.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{user.name}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#787878] mt-0.5">{user.description}</p>
                </div>

                {/* Arrow / Loading */}
                <div className="flex-shrink-0">
                  {loadingRole === user.role ? (
                    <div className="w-5 h-5 border-2 border-[#155387] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      className="w-5 h-5 text-gray-300 group-hover:text-[#155387] transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-[#942e2e] text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <p className="text-xs text-[#787878] text-center mt-6">
          Poppys Knitwear Private Limited — Demo Build
        </p>
      </div>
    </div>
  );
}
