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
      result = await sql`SELECT * FROM pos WHERE status = ${status} ORDER BY updated_at DESC`;
    } else if (user.role === 'po_approver') {
      result = await sql`SELECT * FROM pos WHERE status IN ('READY_FOR_APPROVAL', 'APPROVED', 'REJECTED') ORDER BY updated_at DESC`;
    } else {
      result = await sql`SELECT * FROM pos WHERE created_by = ${user.id} ORDER BY created_at DESC`;
    }

    return NextResponse.json({ pos: result.rows });
  } catch (error) {
    console.error('PO fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      vendor_name,
      vendor_address,
      vendor_email,
      vendor_gst,
      delivery_date,
      place_of_delivery,
      currency,
      conversion_rate,
      terms_of_delivery,
      pay_terms,
      notes,
      line_items,
    } = body;

    // Generate PO number (demo format)
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

    // Determine initial status based on line items
    let hasUnknown = false;
    let hasPending = false;

    if (line_items && Array.isArray(line_items)) {
      for (const item of line_items) {
        if (item.validation_status === 'UNKNOWN_CODE' || item.validation_status === 'PENDING_COLOUR') {
          hasPending = true;
        }
      }
    }

    const status = hasPending ? 'PENDING_COLOUR_APPROVAL' : 'READY_FOR_APPROVAL';

    const result = await sql`
      INSERT INTO pos (po_number, delivery_date, vendor_name, vendor_address, vendor_email, vendor_gst, place_of_delivery, currency, conversion_rate, terms_of_delivery, pay_terms, notes, status, created_by)
      VALUES (${poNumber}, ${delivery_date || null}, ${vendor_name || null}, ${vendor_address || null}, ${vendor_email || null}, ${vendor_gst || null}, ${place_of_delivery || 'POPPYS KNITWEAR [PADIYUR]'}, ${currency || 'INR'}, ${conversion_rate || null}, ${terms_of_delivery || null}, ${pay_terms || null}, ${notes || null}, ${status}, ${user.id})
      RETURNING *
    `;

    const po = result.rows[0];

    // Insert line items
    if (line_items && Array.isArray(line_items)) {
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        await sql`
          INSERT INTO po_line_items (po_id, sno, acc_name, style_no, colour_code, colour_name, size, uom, qty, rate, validation_status)
          VALUES (${po.id}, ${i + 1}, ${item.acc_name || null}, ${item.style_no || null}, ${item.colour_code}, ${item.colour_name}, ${item.size || null}, ${item.uom || 'NOS'}, ${item.qty || 0}, ${item.rate || null}, ${item.validation_status || 'VALID'})
        `;
      }
    }

    // Audit log
    await sql`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
      VALUES (${user.id}, 'CREATE_PO', 'po', ${po.id}, ${JSON.stringify({ po_number: poNumber, status })})
    `;

    return NextResponse.json({ po }, { status: 201 });
  } catch (error) {
    console.error('PO create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
