import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { processMessage, handleAddColour } from '@/lib/chat-engine';

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationId, unknownLines, lineItems, poDraft: draftHeader } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const result = await sql`
        INSERT INTO conversations (user_id, title)
        VALUES (${user.id}, ${message.slice(0, 50)})
        RETURNING id
      `;
      convId = result.rows[0].id;
    }

    // Save user message
    const displayMessage = message.startsWith('__') ? message.replace(/_/g, ' ').trim() : message;
    await sql`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${convId}, 'user', ${displayMessage})
    `;

    let response;

    // Handle bulk add unknown colours from upload validation
    if (message === '__add_unknown_colours__' && unknownLines?.length > 0) {
      const added = [];
      for (const line of unknownLines) {
        await handleAddColour(line.hex_code, line.name || 'UNNAMED', user.id);
        added.push(line.hex_code);
      }
      const hasRemainingIssues = false; // All unknowns are now PENDING
      response = {
        reply: `Added ${added.length} colour${added.length > 1 ? 's' : ''} to the Colour Bank as PENDING:\n\n${added.map((c: string) => `• ${c}`).join('\n')}\n\nThe Colour Bank Manager will review and approve them. Once approved, you can submit the PO.`,
        metadata: null,
        chips: [
          { label: 'Submit PO', action: 'submit_po' },
          { label: 'Upload another PO', action: 'upload_po' },
        ],
      };
    }
    // Handle PO submission from upload validation
    else if (message === '__submit_po__' && lineItems?.length > 0) {
      const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
      const hasPending = lineItems.some((item: { validation_status: string }) =>
        item.validation_status === 'UNKNOWN_CODE' || item.validation_status === 'PENDING_COLOUR'
      );
      const status = hasPending ? 'PENDING_COLOUR_APPROVAL' : 'READY_FOR_APPROVAL';

      const poResult = await sql`
        INSERT INTO pos (
          po_number, status, created_by,
          vendor_name, vendor_address, vendor_email, vendor_gst,
          delivery_date, currency, conversion_rate,
          terms_of_delivery, pay_terms
        )
        VALUES (
          ${poNumber}, ${status}, ${user.id},
          ${draftHeader?.vendor_name || null}, ${draftHeader?.vendor_address || null},
          ${draftHeader?.vendor_email || null}, ${draftHeader?.vendor_gst || null},
          ${draftHeader?.delivery_date || null}, ${draftHeader?.currency || 'INR'},
          ${draftHeader?.conversion_rate || null},
          ${draftHeader?.terms_of_delivery || null}, ${draftHeader?.pay_terms || null}
        )
        RETURNING *
      `;
      const po = poResult.rows[0];

      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        await sql`
          INSERT INTO po_line_items (po_id, sno, acc_name, style_no, colour_code, colour_name, size, uom, qty, rate, validation_status)
          VALUES (${po.id}, ${i + 1}, ${item.acc_name || null}, ${item.style_no || null}, ${item.colour_code}, ${item.colour_name}, ${item.size || null}, ${item.uom || 'NOS'}, ${item.qty || 1}, ${item.rate || null}, ${item.validation_status || 'VALID'})
        `;
      }

      await sql`
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
        VALUES (${user.id}, 'CREATE_PO', 'po', ${po.id}, ${JSON.stringify({ po_number: poNumber, status, source: 'upload' })})
      `;

      // Notify approvers if ready
      if (status === 'READY_FOR_APPROVAL') {
        await sql`
          INSERT INTO notifications (role_target, title, message, entity_type, entity_id)
          VALUES ('po_approver', 'New PO Submitted', ${poNumber + ' is ready for your approval.'}, 'po', ${po.id})
        `;
      }

      await sql`UPDATE conversations SET method = 'pdf_upload' WHERE id = ${convId}`;

      response = {
        reply: status === 'READY_FOR_APPROVAL'
          ? `PO **${poNumber}** has been created and submitted for approval.\n\nAll colours are valid — the PO Approver has been notified.`
          : `PO **${poNumber}** has been created with status **Pending Colour Approval**.\n\nOnce the Colour Bank Manager approves the pending colours, it will automatically move to the PO Approver.`,
        metadata: { type: 'po_submitted' as const, po_id: po.id, po_number: poNumber },
        chips: [
          { label: 'Upload another PO', action: 'upload_po' },
          { label: 'See my recent POs', action: 'recent_pos' },
        ],
      };
    }
    // Check for "add colour" confirmation patterns
    else {
      const addMatch = message.match(/^yes_add_([A-Fa-f0-9]{6})_(.+)$/i);
      if (addMatch) {
        response = await handleAddColour(addMatch[1], addMatch[2], user.id);
      } else {
        response = await processMessage(message, user.id);
      }
    }

    // Save bot response
    await sql`
      INSERT INTO messages (conversation_id, role, content, metadata)
      VALUES (${convId}, 'bot', ${response.reply}, ${JSON.stringify(response.metadata || null)})
    `;

    // Update conversation title if it's the first message
    if (!conversationId) {
      const title = message.length > 40 ? message.slice(0, 40) + '...' : message;
      await sql`UPDATE conversations SET title = ${title} WHERE id = ${convId}`;
    }

    return NextResponse.json({
      reply: response.reply,
      metadata: response.metadata,
      chips: response.chips,
      conversationId: convId,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - list conversations
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'list') {
      const result = await sql`
        SELECT * FROM conversations
        WHERE user_id = ${user.id}
        ORDER BY updated_at DESC
        LIMIT 50
      `;
      return NextResponse.json({ conversations: result.rows });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Chat list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
