'use client';

import { useState, useEffect } from 'react';
import { Colour } from '@/types';
import ColorSwatch from '@/components/po/ColorSwatch';

export default function ColourManagerPage() {
  const [pendingColours, setPendingColours] = useState<Colour[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState<{ id: number; reason: string } | null>(null);

  useEffect(() => {
    fetchPendingColours();
  }, []);

  async function fetchPendingColours() {
    try {
      const res = await fetch('/api/colours?status=PENDING');
      if (res.ok) {
        const data = await res.json();
        setPendingColours(data.colours || []);
      }
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }

  async function approveColour(id: number) {
    const res = await fetch(`/api/colours/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    if (res.ok) {
      setPendingColours((prev) => prev.filter((c) => c.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function rejectColour(id: number, reason: string) {
    const res = await fetch(`/api/colours/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    });
    if (res.ok) {
      setPendingColours((prev) => prev.filter((c) => c.id !== id));
      setRejectReason(null);
    }
  }

  async function bulkApprove() {
    for (const id of selected) {
      await approveColour(id);
    }
    setSelected(new Set());
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-[#155387]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#155387]">Colour Bank Manager</h1>
          <p className="text-[#787878] text-sm mt-1">
            Review and approve pending colour additions
          </p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={bulkApprove}
            className="px-4 py-2 bg-[#348734] text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            ✅ Approve all selected ({selected.size})
          </button>
        )}
      </div>

      {pendingColours.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-medium text-gray-700">All clear!</h2>
          <p className="text-[#787878]">No colours waiting for your approval right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingColours.map((colour) => (
            <div
              key={colour.id}
              className="border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:border-[#3ba6ff] transition-colors"
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(colour.id)}
                onChange={() => toggleSelect(colour.id)}
                className="w-4 h-4 text-[#155387] rounded"
              />

              {/* Swatch */}
              <ColorSwatch hexCode={colour.hex_code} size="lg" />

              {/* Details */}
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {colour.hex_code} — {colour.name}
                </div>
                <div className="text-xs text-[#787878] mt-0.5">
                  Added {new Date(colour.created_at).toLocaleDateString()}
                  {colour.source_po && ` • From PO #${colour.source_po}`}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => approveColour(colour.id)}
                  className="px-3 py-1.5 bg-[#348734] text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => setRejectReason({ id: colour.id, reason: '' })}
                  className="px-3 py-1.5 bg-[#942e2e] text-white text-sm rounded-lg hover:bg-red-800 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectReason && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Colour</h3>
            <textarea
              value={rejectReason.reason}
              onChange={(e) =>
                setRejectReason({ ...rejectReason, reason: e.target.value })
              }
              placeholder="Reason for rejection (required)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[#155387]"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setRejectReason(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectColour(rejectReason.id, rejectReason.reason)}
                disabled={!rejectReason.reason.trim()}
                className="px-4 py-2 text-sm bg-[#942e2e] text-white rounded-lg disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
