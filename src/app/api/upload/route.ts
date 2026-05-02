import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { validateMultipleLines, normalizeHexCode } from '@/lib/validation';
import path from 'path';
import { pathToFileURL } from 'url';

export const maxDuration = 60;

// Resolve pdfjs worker path for both local and Vercel environments
function getPdfjsWorkerSrc(): string {
  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  return pathToFileURL(workerPath).href;
}


// Text-based PDF extraction
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc();

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

// OCR for scanned PDFs — renders pages via pdfjs + @napi-rs/canvas, then runs Tesseract
async function extractTextFromScannedPDF(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc();
  const { createCanvas } = await import('@napi-rs/canvas');
  const { createWorker } = await import('tesseract.js');

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const worker = await createWorker('eng');
  let fullText = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page.render as any)({
      canvasContext: context,
      viewport,
    }).promise;

    const pngBuffer = canvas.toBuffer('image/png');
    const { data: { text } } = await worker.recognize(pngBuffer);
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

// Check if a 6-char hex string is likely a colour code based on its surrounding context
function isLikelyColourCode(hex: string, surroundingText: string): boolean {
  const lower = surroundingText.toLowerCase();

  // Skip hex codes found in address/header lines (pincodes, GST, phone etc.)
  if (lower.includes('tirupur') || lower.includes('tamil nadu') || lower.includes('gst no')) return false;

  // Skip if it appears as a decimal quantity (e.g., "220450.000")
  if (surroundingText.includes(hex + '.')) return false;

  // Skip if preceded by TOTAL (it's a sum)
  if (lower.includes('total') && /^\d{6}$/.test(hex)) return false;

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

    // Store as Uint8Array immediately — ArrayBuffer can get detached in serverless
    const rawBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(rawBuffer);

    // Extract text based on file type
    let extractedText = '';
    let usedOCR = false;

    if (file.type === 'application/pdf') {
      // Step 1: Try text extraction (fast, works for text-based PDFs)
      let textError = '';
      try {
        extractedText = await extractTextFromPDF(fileBytes.buffer.slice(0));
        console.log('Text extraction result length:', extractedText.trim().length);
      } catch (err) {
        textError = err instanceof Error ? err.message : String(err);
        console.error('PDF text extraction failed:', textError);
      }

      // Step 2: If empty, try OCR (slower, works for scanned PDFs)
      if (!extractedText.trim()) {
        try {
          extractedText = await extractTextFromScannedPDF(fileBytes.buffer.slice(0));
          usedOCR = true;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const errStack = err instanceof Error ? err.stack?.slice(0, 500) : '';
          console.error('OCR failed:', errMsg, errStack);
          return NextResponse.json({
            reply: `⚠️ I could not read this PDF.\n\n**Text extraction:** ${textError || 'No text found (scanned PDF)'}\n**OCR error:** ${errMsg}\n\nYou can:\n1. Try uploading a text-based PDF\n2. Use the manual PO creation form instead`,
            chips: [
              { label: '📝 Create PO manually', action: 'create_po' },
              { label: '📄 Try another file', action: 'upload_po' },
            ],
          });
        }
      }
    } else {
      try {
        extractedText = await extractTextFromWord(fileBytes.buffer.slice(0));
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

    if (!extractedText.trim()) {
      return NextResponse.json({
        reply: '⚠️ I could not find any readable text in this file. You can:\n\n1. Try a different file\n2. Use the manual PO creation form',
        chips: [
          { label: '📝 Create PO manually', action: 'create_po' },
          { label: '📄 Try another file', action: 'upload_po' },
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
