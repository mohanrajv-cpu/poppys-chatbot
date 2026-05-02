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

    const { message, conversationId } = await request.json();

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
    await sql`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${convId}, 'user', ${message})
    `;

    // Check if this is a colour name response (user providing name for unknown code)
    // Pattern: message looks like it could be a colour name after an add_colour prompt
    let response;

    // Check for "add colour" confirmation patterns
    const addMatch = message.match(/^yes_add_([A-Fa-f0-9]{6})_(.+)$/i);
    if (addMatch) {
      response = await handleAddColour(addMatch[1], addMatch[2], user.id);
    } else {
      response = await processMessage(message, user.id);
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
