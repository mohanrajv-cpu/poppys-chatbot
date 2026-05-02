import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let result;
    if (status) {
      result = await sql`SELECT * FROM colours WHERE status = ${status} ORDER BY created_at DESC`;
    } else {
      result = await sql`SELECT * FROM colours ORDER BY name ASC`;
    }

    return NextResponse.json({ colours: result.rows });
  } catch (error) {
    console.error('Colours fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { hex_code, name, source_po } = await request.json();

    if (!hex_code || !name) {
      return NextResponse.json(
        { error: 'hex_code and name are required' },
        { status: 400 }
      );
    }

    const normalized = hex_code.replace(/^#/, '').toUpperCase();

    // Check if already exists
    const existing = await sql`SELECT * FROM colours WHERE UPPER(hex_code) = ${normalized}`;
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'This colour code already exists', colour: existing.rows[0] },
        { status: 409 }
      );
    }

    const result = await sql`
      INSERT INTO colours (hex_code, name, status, added_by, source_po)
      VALUES (${normalized}, ${name}, 'PENDING', ${user.id}, ${source_po || null})
      RETURNING *
    `;

    // Log the action
    await sql`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
      VALUES (${user.id}, 'ADD_COLOUR', 'colour', ${result.rows[0].id}, ${JSON.stringify({ hex_code: normalized, name })})
    `;

    return NextResponse.json({ colour: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Colour create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
