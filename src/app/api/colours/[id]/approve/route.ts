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

    // Only colour managers can approve/reject
    if (user.role !== 'colour_manager') {
      return NextResponse.json(
        { error: 'Only the Colour Bank Manager can approve or reject colours' },
        { status: 403 }
      );
    }

    const { id } = await params;
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

    const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED';

    const result = await sql`
      UPDATE colours
      SET status = ${newStatus},
          approved_by = ${user.id},
          rejection_reason = ${reason || null},
          updated_at = NOW()
      WHERE id = ${parseInt(id)} AND status = 'PENDING'
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Colour not found or not in PENDING status' },
        { status: 404 }
      );
    }

    const colour = result.rows[0];

    // Log the action
    await sql`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
      VALUES (${user.id}, ${action === 'approve' ? 'APPROVE_COLOUR' : 'REJECT_COLOUR'}, 'colour', ${parseInt(id)}, ${JSON.stringify({ reason: reason || null })})
    `;

    // If approved and there's a source PO, check if all colours on that PO are now ACTIVE
    if (action === 'approve' && colour.source_po) {
      const pendingOnPO = await sql`
        SELECT COUNT(*) as count FROM po_line_items pli
        JOIN colours c ON UPPER(c.hex_code) = UPPER(pli.colour_code)
        WHERE pli.po_id = ${colour.source_po} AND c.status != 'ACTIVE'
      `;

      if (parseInt(pendingOnPO.rows[0].count) === 0) {
        // All colours on this PO are now ACTIVE — update PO status
        await sql`
          UPDATE pos SET status = 'READY_FOR_APPROVAL', updated_at = NOW()
          WHERE id = ${colour.source_po} AND status = 'PENDING_COLOUR_APPROVAL'
        `;

        // TODO: Send email notification to PO Approver
      }
    }

    return NextResponse.json({ colour: result.rows[0] });
  } catch (error) {
    console.error('Colour approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
