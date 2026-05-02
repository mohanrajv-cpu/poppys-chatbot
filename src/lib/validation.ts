import { sql } from './db';
import { Colour, ValidationVerdict, ValidationLine } from '@/types';

/**
 * Normalize a hex code: strip #, uppercase
 */
export function normalizeHexCode(code: string): string {
  return code.replace(/^#/, '').toUpperCase().trim();
}

/**
 * Normalize a colour name: uppercase, remove extra spaces, treat space/no-separator as underscore
 * e.g., "red 25" -> "RED_25", "RED25" -> "RED_25", "red_25" -> "RED_25"
 */
export function normalizeColourName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[\s_]+/g, '_')
    .replace(/([A-Z]+)(\d+)/, '$1_$2'); // "RED25" -> "RED_25"
}

/**
 * Look up a colour by hex code
 */
export async function findColourByCode(hexCode: string): Promise<Colour | null> {
  const normalized = normalizeHexCode(hexCode);
  const result = await sql`
    SELECT * FROM colours WHERE UPPER(hex_code) = ${normalized}
  `;
  return (result.rows[0] as Colour) || null;
}

/**
 * Quick Check (Method 2): Just check if a code exists
 * Returns the colour if found, null if not
 */
export async function quickCheckCode(hexCode: string): Promise<{
  exists: boolean;
  colour: Colour | null;
}> {
  const colour = await findColourByCode(hexCode);
  return { exists: !!colour, colour };
}

/**
 * Validate a single PO line item (Method 1 & 3):
 * - Code exists + name matches -> VALID
 * - Code exists + name wrong -> NAME_MISMATCH
 * - Code doesn't exist -> UNKNOWN_CODE
 */
export async function validateLineItem(
  hexCode: string,
  colourName: string
): Promise<{
  verdict: ValidationVerdict;
  colour: Colour | null;
  message: string;
}> {
  const colour = await findColourByCode(hexCode);

  if (!colour) {
    return {
      verdict: 'UNKNOWN_CODE',
      colour: null,
      message: `Colour code ${normalizeHexCode(hexCode)} does not exist in the Colour Bank.`,
    };
  }

  if (colour.status === 'PENDING') {
    return {
      verdict: 'PENDING_COLOUR',
      colour,
      message: `Colour code ${normalizeHexCode(hexCode)} is pending approval (${colour.name}).`,
    };
  }

  const normalizedInput = normalizeColourName(colourName);
  const normalizedOfficial = normalizeColourName(colour.name);

  if (normalizedInput === normalizedOfficial) {
    return {
      verdict: 'VALID',
      colour,
      message: `✅ ${normalizeHexCode(hexCode)} matches ${colour.name}.`,
    };
  }

  return {
    verdict: 'NAME_MISMATCH',
    colour,
    message: `⚠️ ${normalizeHexCode(hexCode)} is registered as ${colour.name}, not ${colourName}. Please use the correct name.`,
  };
}

/**
 * Validate multiple line items at once (for PDF upload or PO form)
 */
export async function validateMultipleLines(
  lines: { sno: number; colour_code: string; colour_name: string }[]
): Promise<ValidationLine[]> {
  const results: ValidationLine[] = [];

  for (const line of lines) {
    const { verdict, colour, message } = await validateLineItem(
      line.colour_code,
      line.colour_name
    );

    results.push({
      sno: line.sno,
      colour_code: normalizeHexCode(line.colour_code),
      entered_name: line.colour_name,
      official_name: colour?.name || null,
      status: colour?.status || null,
      verdict,
    });
  }

  return results;
}

/**
 * Add a new colour to the Colour Bank as PENDING
 */
export async function addPendingColour(
  hexCode: string,
  name: string,
  addedBy: number,
  sourcePo: number | null = null
): Promise<Colour> {
  const normalized = normalizeHexCode(hexCode);
  const result = await sql`
    INSERT INTO colours (hex_code, name, status, added_by, source_po)
    VALUES (${normalized}, ${name}, 'PENDING', ${addedBy}, ${sourcePo})
    ON CONFLICT (hex_code) DO UPDATE SET
      name = EXCLUDED.name,
      added_by = EXCLUDED.added_by,
      source_po = COALESCE(EXCLUDED.source_po, colours.source_po)
    RETURNING *
  `;
  return result.rows[0] as Colour;
}
