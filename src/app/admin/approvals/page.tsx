'use client';

import { useState, useEffect } from 'react';
import { PO } from '@/types';

export default function POApprovalPage() {
  const [pos, setPOs] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ id: number; reason: string } | null>(null);

  useEffect(() => {
    fetchPOs();
  }, []);

  async function fetchPOs() {
    try {
      const res = await fetch('/api/po?status=READY_FOR_APPROVAL');
      if (res.ok) {
        const data = await res.json();
        setPOs(data.pos || []);
      }
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }

  async function approvePO(id: number) {
    const res = await fetch(`/api/po/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    if (res.ok) {
      setPOs((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function rejectPO(id: number, reason: string) {
    const res = await fetch(`/api/po/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    });
    if (res.ok) {
      setPOs((prev) => prev.filter((p) => p.id !== id));
      setRejectModal(null);
    }
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#155387]">PO Approvals</h1>
        <p className="text-[#787878] text-sm mt-1">
          Review and approve submitted Purchase Orders
        </p>
      </div>

      {pos.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-medium text-gray-700">Nothing to approve</h2>
          <p className="text-[#787878]">
            You'll get an email when a PO is ready for your approval.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pos.map((po) => (
            <div
              key={po.id}
              className="border border-gray-200 rounded-xl p-5 hover:border-[#3ba6ff] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 text-lg">
                    {po.po_number}
                  </h3>
                  <p className="text-sm text-[#787878] mt-1">
                    Vendor: {po.vendor_name || 'Not specified'}
                  </p>
                  <p className="text-xs text-[#787878] mt-0.5">
                    Submitted {new Date(po.updated_at).toLocaleDateString()} •
                    Delivery: {po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : 'TBD'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => approvePO(po.id)}
                    className="px-4 py-2 bg-[#348734] text-white text-sm rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    ✅ Approve PO
                  </button>
                  <button
                    onClick={() => setRejectModal({ id: po.id, reason: '' })}
                    className="px-4 py-2 bg-[#942e2e] text-white text-sm rounded-lg font-medium hover:bg-red-800 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {po.pdf_url && (
                <div className="mt-3">
                  <a
                    href={po.pdf_url}
                    target="_blank"
                    className="text-sm text-[#155387] hover:underline"
                  >
                    📄 View PO PDF
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reject PO</h3>
            <textarea
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal({ ...rejectModal, reason: e.target.value })
              }
              placeholder="Reason for rejection (required)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[#155387]"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectPO(rejectModal.id, rejectModal.reason)}
                disabled={!rejectModal.reason.trim()}
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
