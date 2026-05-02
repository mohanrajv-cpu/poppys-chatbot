import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch notifications targeted at this user or their role
    const result = await sql`
      SELECT * FROM notifications
      WHERE user_id = ${user.id} OR role_target = ${user.role}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({ notifications: result.rows });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (id === 'all') {
      await sql`
        UPDATE notifications SET is_read = TRUE
        WHERE user_id = ${user.id} OR role_target = ${user.role}
      `;
    } else {
      await sql`
        UPDATE notifications SET is_read = TRUE WHERE id = ${id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
