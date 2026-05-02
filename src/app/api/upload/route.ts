import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { validateMultipleLines, normalizeHexCode } from '@/lib/validation';

// Simple PDF text extraction (server-side)
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  // Using pdf.js for text extraction
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let fullText = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => (item as { str?: string }).str || '')
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

// Extract text from Word document
async function extractTextFromWord(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value;
}

// Parse extracted text to find colour codes and names
function parseColourLines(text: string): { sno: number; colour_code: string; colour_name: string }[] {
  const lines: { sno: number; colour_code: string; colour_name: string }[] = [];

  // Pattern 1: Look for 6-char hex codes in text
  const hexPattern = /\b([0-9A-Fa-f]{6})\b/g;
  let match;
  let sno = 1;

  // Split text into rows/lines and find hex codes with their associated colour names
  const textLines = text.split(/\n|\r/);

  for (const line of textLines) {
    hexPattern.lastIndex = 0;
    while ((match = hexPattern.exec(line)) !== null) {
      const hexCode = match[1];

      // Try to find a colour name near the hex code
      // Look for patterns like: HEXCODE ... COLOURNAME or COLOURNAME ... HEXCODE
      const namePattern = /\b([A-Z][A-Z_]+(?:_\d+)?)\b/g;
      let nameMatch;
      let colourName = '';

      while ((nameMatch = namePattern.exec(line)) !== null) {
        const potential = nameMatch[1];
        // Skip if it looks like just another hex code or common PO terms
        if (
          /^[0-9A-F]{6}$/.test(potential) ||
          ['NOS', 'KGS', 'MTRS', 'PCS', 'UOM', 'QTY', 'GST', 'INR', 'USD', 'EUR'].includes(potential)
        ) {
          continue;
        }
        colourName = potential;
        break;
      }

      lines.push({
        sno: sno++,
        colour_code: hexCode,
        colour_name: colourName || 'UNKNOWN',
      });
    }
  }

  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF and Word documents are accepted' },
        { status: 400 }
      );
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be under 10MB' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    // Extract text based on file type
    let extractedText: string;
    try {
      if (file.type === 'application/pdf') {
        extractedText = await extractTextFromPDF(buffer);
      } else {
        extractedText = await extractTextFromWord(buffer);
      }
    } catch (err) {
      return NextResponse.json({
        reply: '⚠��� I could not read this file. It might be a scanned document or in an unsupported format. You can:\n\n1. Try uploading a different version\n2. Use the manual PO creation form instead',
        chips: [
          { label: '📄 Try another file', action: 'upload_po' },
          { label: '📝 Create PO manually', action: 'create_po' },
        ],
      });
    }

    // Parse colour lines from extracted text
    const colourLines = parseColourLines(extractedText);

    if (colourLines.length === 0) {
      return NextResponse.json({
        reply: '⚠️ I could not find any colour codes in this document. The file might not contain hex colour codes in the expected format.\n\nWould you like to enter the colours manually?',
        chips: [
          { label: '📝 Create PO manually', action: 'create_po' },
          { label: '🔍 Quick colour check', action: 'quick_check' },
        ],
      });
    }

    // Validate all extracted lines
    const validationResults = await validateMultipleLines(colourLines);

    const valid = validationResults.filter((r) => r.verdict === 'VALID').length;
    const mismatches = validationResults.filter((r) => r.verdict === 'NAME_MISMATCH').length;
    const unknown = validationResults.filter((r) => r.verdict === 'UNKNOWN_CODE').length;

    let reply = `📄 I found **${colourLines.length} colour entries** in "${file.name}".\n\n`;
    reply += `**Validation Results:**\n`;
    reply += `• ✅ Valid: ${valid}\n`;
    if (mismatches > 0) reply += `• ⚠️ Name mismatches: ${mismatches}\n`;
    if (unknown > 0) reply += `• ❌ Unknown codes: ${unknown}\n`;

    if (mismatches === 0 && unknown === 0) {
      reply += `\nAll colours are valid! You can submit this PO for approval.`;
    } else {
      reply += `\nPlease fix the issues above before submitting. You can correct them inline or re-upload a corrected file.`;
    }

    // Create/get conversation
    let convId = conversationId ? parseInt(conversationId) : null;
    if (!convId) {
      const result = await sql`
        INSERT INTO conversations (user_id, title, method)
        VALUES (${user.id}, ${'Validate: ' + file.name}, 'pdf_upload')
        RETURNING id
      `;
      convId = result.rows[0].id;
    }

    // Save messages
    await sql`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${convId}, 'user', ${'Uploaded: ' + file.name})
    `;
    await sql`
      INSERT INTO messages (conversation_id, role, content, metadata)
      VALUES (${convId}, 'bot', ${reply}, ${JSON.stringify({ type: 'validation_result', lines: validationResults })})
    `;

    const chips = [];
    if (unknown > 0) {
      chips.push({ label: 'Add unknown colours to Bank', action: 'add_unknown_colours' });
    }
    if (mismatches === 0 && unknown === 0) {
      chips.push({ label: '✅ Submit PO', action: 'submit_po' });
    }
    chips.push({ label: '📄 Re-upload corrected file', action: 'upload_po' });

    return NextResponse.json({
      reply,
      metadata: { type: 'validation_result', lines: validationResults },
      chips,
      conversationId: convId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
