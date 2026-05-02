import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { validateMultipleLines, normalizeHexCode } from '@/lib/validation';

// Allow up to 60 seconds for OCR processing
export const maxDuration = 60;

// Text-based PDF extraction
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
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

// OCR for scanned PDFs — converts pages to images then runs Tesseract
async function extractTextFromScannedPDF(buffer: ArrayBuffer): Promise<string> {
  const { pdf } = await import('pdf-to-img');
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('eng');
  let fullText = '';

  const doc = await pdf(Buffer.from(buffer), { scale: 2 });
  for await (const pageImage of doc) {
    const { data: { text } } = await worker.recognize(pageImage);
    fullText += text + '\n';
  }

  await worker.terminate();
  return fullText;
}

// Extract text from Word document
async function extractTextFromWord(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value;
}

// Check if a 6-char hex string is likely a colour code (not a quantity, pincode, etc.)
function isLikelyColourCode(hex: string, surroundingText: string): boolean {
  // Pure numeric 6-digit strings are usually quantities, pincodes, dates — not colours
  if (/^\d{6}$/.test(hex)) return false;

  // Must contain at least one letter (A-F) to be a plausible hex colour
  if (!/[a-fA-F]/.test(hex)) return false;

  // Skip if it appears near known non-colour context (GST numbers, phone numbers, etc.)
  const lower = surroundingText.toLowerCase();
  if (lower.includes('gst') || lower.includes('phone') || lower.includes('tirupur') || lower.includes('tamil nadu')) return false;

  return true;
}

// Parse extracted text to find colour codes and names
function parseColourLines(text: string): { sno: number; colour_code: string; colour_name: string }[] {
  const lines: { sno: number; colour_code: string; colour_name: string }[] = [];

  const hexPattern = /\b([0-9A-Fa-f]{6})\b/g;
  let match;
  let sno = 1;

  const textLines = text.split(/\n|\r/);

  for (const line of textLines) {
    hexPattern.lastIndex = 0;
    while ((match = hexPattern.exec(line)) !== null) {
      const hexCode = match[1];

      // Filter out false positives
      if (!isLikelyColourCode(hexCode, line)) continue;

      // Try to find a colour name near the hex code
      const namePattern = /\b([A-Z][A-Z_]+(?:_\d+)?)\b/g;
      let nameMatch;
      let colourName = '';

      while ((nameMatch = namePattern.exec(line)) !== null) {
        const potential = nameMatch[1];
        if (
          /^[0-9A-F]{6}$/.test(potential) ||
          ['NOS', 'KGS', 'MTRS', 'PCS', 'UOM', 'QTY', 'GST', 'INR', 'USD', 'EUR',
           'ACC', 'STYLE', 'DESCRIPTION', 'SHADENO', 'COLOR', 'SIZES', 'TOTAL',
           'GROSS', 'PURCHASE', 'BUTTON', 'ZIP', 'TAPE', 'LACE', 'PRONGS',
           'CAPPED', 'VENDOR', 'EMAIL', 'DELIVERY', 'TERMS', 'PLACE',
           'POPPYS', 'KNITWEAR', 'PRIVATE', 'LIMITED', 'ACCESSORIES'].includes(potential)
        ) {
          continue;
        }
        colourName = potential;
        break;
      }

      lines.push({
        sno: sno++,
        colour_code: hexCode.toUpperCase(),
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
    let extractedText = '';
    let usedOCR = false;

    if (file.type === 'application/pdf') {
      // Step 1: Try text extraction
      try {
        extractedText = await extractTextFromPDF(buffer);
      } catch (err) {
        console.error('PDF text extraction failed:', err);
      }

      // Step 2: If no text found, fall back to OCR (scanned PDF)
      if (!extractedText.trim()) {
        try {
          extractedText = await extractTextFromScannedPDF(buffer);
          usedOCR = true;
        } catch (err) {
          console.error('OCR extraction failed:', err);
          return NextResponse.json({
            reply: '⚠️ I could not read this file. PDF text extraction and OCR both failed. You can:\n\n1. Try uploading a text-based PDF (not a scanned image)\n2. Use the manual PO creation form instead',
            chips: [
              { label: '📄 Try another file', action: 'upload_po' },
              { label: '📝 Create PO manually', action: 'create_po' },
            ],
          });
        }
      }
    } else {
      try {
        extractedText = await extractTextFromWord(buffer);
      } catch (err) {
        console.error('Word extraction failed:', err);
        return NextResponse.json({
          reply: '⚠️ I could not read this Word document. You can:\n\n1. Try uploading a different version\n2. Use the manual PO creation form instead',
          chips: [
            { label: '📄 Try another file', action: 'upload_po' },
            { label: '📝 Create PO manually', action: 'create_po' },
          ],
        });
      }
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

    let reply = `📄 I found **${colourLines.length} colour entries** in "${file.name}"${usedOCR ? ' (scanned via OCR)' : ''}.\n\n`;
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
