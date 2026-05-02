import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only PO approvers can approve/reject POs
    if (user.role !== 'po_approver') {
      return NextResponse.json(
        { error: 'Only the PO Approver can approve or reject POs' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const poId = parseInt(id);
    const { action, reason } = await request.json();

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'reject' && !reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // HARD RULE: Check that all colours on this PO are ACTIVE before approving
    if (action === 'approve') {
      const nonActiveColours = await sql`
        SELECT pli.colour_code, c.status
        FROM po_line_items pli
        LEFT JOIN colours c ON UPPER(c.hex_code) = UPPER(pli.colour_code)
        WHERE pli.po_id = ${poId}
          AND (c.status IS NULL OR c.status != 'ACTIVE')
      `;

      if (nonActiveColours.rows.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot approve PO — some colours are not ACTIVE in the Colour Bank',
            blocked_colours: nonActiveColours.rows,
          },
          { status: 422 }
        );
      }
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const result = await sql`
      UPDATE pos
      SET status = ${newStatus},
          approved_by = ${user.id},
          updated_at = NOW()
      WHERE id = ${poId} AND status = 'READY_FOR_APPROVAL'
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'PO not found or not in READY_FOR_APPROVAL status' },
        { status: 404 }
      );
    }

    // Audit log
    await sql`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
      VALUES (${user.id}, ${action === 'approve' ? 'APPROVE_PO' : 'REJECT_PO'}, 'po', ${poId}, ${JSON.stringify({ reason: reason || null })})
    `;

    // TODO: Send email notification to PO Creator
    // TODO: If approved, generate final clean PDF

    return NextResponse.json({ po: result.rows[0] });
  } catch (error) {
    console.error('PO approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
