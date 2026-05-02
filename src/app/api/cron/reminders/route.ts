import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Vercel Cron job: runs every hour, sends 24h reminders
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find PENDING colours older than 24 hours that haven't had a reminder sent
    const staleColours = await sql`
      SELECT c.*, u.email as creator_email, u.name as creator_name
      FROM colours c
      LEFT JOIN users u ON c.added_by = u.id
      WHERE c.status = 'PENDING'
        AND c.created_at < NOW() - INTERVAL '24 hours'
        AND c.id NOT IN (
          SELECT related_entity_id FROM email_log
          WHERE template = 'reminder_pending_colour'
            AND related_entity_type = 'colour'
        )
    `;

    // Find POs in READY_FOR_APPROVAL older than 24 hours without a reminder
    const stalePOs = await sql`
      SELECT p.*, u.email as creator_email, u.name as creator_name
      FROM pos p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.status = 'READY_FOR_APPROVAL'
        AND p.updated_at < NOW() - INTERVAL '24 hours'
        AND p.id NOT IN (
          SELECT related_entity_id FROM email_log
          WHERE template = 'reminder_po_approval'
            AND related_entity_type = 'po'
        )
    `;

    let remindersSent = 0;

    // Send reminders for stale colours (to Colour Bank Manager)
    if (staleColours.rows.length > 0) {
      // Notify colour managers via dashboard
      await sql`
        INSERT INTO notifications (role_target, title, message, entity_type, entity_id)
        VALUES (
          'colour_manager',
          'Pending Colours Reminder',
          ${staleColours.rows.length + ' colour(s) have been waiting for approval for over 24 hours.'},
          'colour',
          ${staleColours.rows[0].id}
        )
      `;
      remindersSent++;
    }

    // Send reminders for stale POs (to PO Approver)
    for (const po of stalePOs.rows) {
      // Notify PO approvers via dashboard
      await sql`
        INSERT INTO notifications (role_target, title, message, entity_type, entity_id)
        VALUES (
          'po_approver',
          'PO Approval Reminder',
          ${'PO ' + po.po_number + ' has been waiting for approval for over 24 hours.'},
          'po',
          ${po.id}
        )
      `;
      remindersSent++;
    }

    return NextResponse.json({
      success: true,
      reminders_sent: remindersSent,
      stale_colours: staleColours.rows.length,
      stale_pos: stalePOs.rows.length,
    });
  } catch (error) {
    console.error('Cron reminders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
