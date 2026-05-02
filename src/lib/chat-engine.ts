import { SuggestionChip, MessageMetadata } from '@/types';
import { quickCheckCode, validateLineItem, normalizeHexCode, addPendingColour } from './validation';

export interface ChatResponse {
  reply: string;
  metadata?: MessageMetadata;
  chips?: SuggestionChip[];
  intent?: string;
}

// Detect intent from user message
export function detectIntent(message: string): string {
  const lower = message.toLowerCase().trim();

  // Quick check - user typed a hex code
  if (/^#?[0-9a-f]{6}$/i.test(lower.replace(/^#/, ''))) {
    return 'quick_check_code';
  }

  // Quick check - code + name pattern
  if (/^#?[0-9a-f]{6}[\s,/]+\w+/i.test(lower)) {
    return 'quick_check_pair';
  }

  // Upload/validate PO
  if (lower.includes('validate') && (lower.includes('po') || lower.includes('pdf') || lower.includes('doc'))) {
    return 'upload_po';
  }
  if (lower.includes('upload')) return 'upload_po';

  // Create PO
  if (lower.includes('create') && lower.includes('po')) return 'create_po';
  if (lower.includes('new po')) return 'create_po';

  // Quick colour check
  if (lower.includes('quick') && lower.includes('colour')) return 'quick_check_start';
  if (lower.includes('quick') && lower.includes('color')) return 'quick_check_start';
  if (lower.includes('check') && lower.includes('colour')) return 'quick_check_start';
  if (lower.includes('check') && lower.includes('color')) return 'quick_check_start';

  // Recent POs
  if (lower.includes('recent') && lower.includes('po')) return 'recent_pos';
  if (lower.includes('my po')) return 'recent_pos';

  // Add colour (when user says yes to adding)
  if (lower === 'yes' || lower.includes('add it') || lower.includes('add colour') || lower.includes('add color')) {
    return 'confirm_add_colour';
  }

  return 'general';
}

// Process a chat message and return a response
export async function processMessage(
  message: string,
  userId: number,
  context?: { lastIntent?: string; pendingHexCode?: string }
): Promise<ChatResponse> {
  const intent = detectIntent(message);

  switch (intent) {
    case 'quick_check_code':
      return handleQuickCheckCode(message);

    case 'quick_check_pair':
      return handleQuickCheckPair(message, userId);

    case 'quick_check_start':
      return {
        reply: '🔍 Quick Colour Check mode. Type a colour code (e.g., FFCFCF) and I\'ll tell you if it exists in the Colour Bank.',
        chips: [
          { label: 'FFCFCF', action: 'FFCFCF' },
          { label: '3BA6FF', action: '3BA6FF' },
          { label: '348734', action: '348734' },
        ],
        intent: 'quick_check_start',
      };

    case 'upload_po':
      return {
        reply: '���� Sure! Please upload your PO document (PDF or Word) using the paperclip icon or drag-and-drop it here. I\'ll validate all the colour codes and names for you.',
        intent: 'upload_po',
      };

    case 'create_po':
      return {
        reply: '📝 Let\'s create a new PO. I\'ll guide you through the form step by step.\n\nFirst, who is the vendor?',
        chips: [
          { label: 'YKK Thailand Co. Ltd', action: 'YKK Thailand Co. Ltd' },
        ],
        intent: 'create_po',
      };

    case 'recent_pos':
      return {
        reply: '📋 Here are your recent POs:\n\n(No POs created yet. Create your first PO using the form or upload an existing one!)',
        chips: [
          { label: '📝 Create a new PO', action: 'create_po' },
          { label: '📄 Upload a PO', action: 'upload_po' },
        ],
        intent: 'recent_pos',
      };

    default:
      return {
        reply: 'I can help you with:\n\n• **Quick colour check** — verify if a code exists in the Colour Bank\n• **Validate a PO** — upload a PDF/Word document for validation\n• **Create a new PO** — guided form with colour validation\n\nWhat would you like to do?',
        chips: [
          { label: '🔍 Quick colour check', action: 'quick_check' },
          { label: '📄 Validate a PO', action: 'upload_po' },
          { label: '📝 Create a new PO', action: 'create_po' },
        ],
        intent: 'general',
      };
  }
}

async function handleQuickCheckCode(message: string): Promise<ChatResponse> {
  const hexCode = normalizeHexCode(message);
  const { exists, colour } = await quickCheckCode(hexCode);

  if (exists && colour) {
    return {
      reply: `✅ ${hexCode} exists in the Colour Bank.\n\nOfficial name: **${colour.name}** (Status: ${colour.status})`,
      metadata: { type: 'colour_added', hex_code: hexCode, name: colour.name },
      chips: [
        { label: '🔍 Check another code', action: 'quick_check' },
        { label: '📝 Create a new PO', action: 'create_po' },
      ],
      intent: 'quick_check_result',
    };
  }

  return {
    reply: `❌ ${hexCode} is not in the Colour Bank.\n\nWould you like to add it? If yes, please provide the colour name you want to register for ${hexCode}.`,
    metadata: { type: 'add_colour_prompt', hex_code: hexCode },
    chips: [
      { label: 'Add new colour', action: `add_colour_${hexCode}` },
      { label: 'Check another code', action: 'quick_check' },
    ],
    intent: 'quick_check_not_found',
  };
}

async function handleQuickCheckPair(message: string, userId: number): Promise<ChatResponse> {
  // Parse "FFCFCF RED_25" or "FFCFCF, RED_25" or "FFCFCF / RED_25"
  const cleaned = message.replace(/^#/, '').trim();
  const parts = cleaned.split(/[\s,/]+/);

  if (parts.length < 2) {
    return handleQuickCheckCode(message);
  }

  const hexCode = parts[0];
  const colourName = parts.slice(1).join('_');

  const result = await validateLineItem(hexCode, colourName);

  if (result.verdict === 'VALID') {
    return {
      reply: `✅ ${normalizeHexCode(hexCode)} + ${result.colour!.name} — correct match. The colour is ${result.colour!.status} in the Colour Bank.`,
      chips: [
        { label: '🔍 Check another', action: 'quick_check' },
        { label: '📝 Create a new PO', action: 'create_po' },
      ],
      intent: 'quick_check_valid',
    };
  }

  if (result.verdict === 'NAME_MISMATCH') {
    return {
      reply: `⚠️ ${normalizeHexCode(hexCode)} is registered as **${result.colour!.name}** in the Colour Bank, not as ${colourName}. Please use the official name.`,
      chips: [
        { label: '🔍 Check another', action: 'quick_check' },
      ],
      intent: 'quick_check_mismatch',
    };
  }

  // Unknown code
  return {
    reply: `❌ ${normalizeHexCode(hexCode)} is not in the Colour Bank.\n\nWould you like to add it with the name "${colourName}"? Type "yes" to confirm.`,
    metadata: { type: 'add_colour_prompt', hex_code: normalizeHexCode(hexCode) },
    chips: [
      { label: 'Yes, add it', action: `yes_add_${hexCode}_${colourName}` },
      { label: 'No, correct the code', action: 'quick_check' },
    ],
    intent: 'quick_check_unknown',
  };
}

// Add a pending colour (called when user confirms)
export async function handleAddColour(
  hexCode: string,
  name: string,
  userId: number,
  sourcePo: number | null = null
): Promise<ChatResponse> {
  const colour = await addPendingColour(hexCode, name, userId, sourcePo);

  return {
    reply: `✅ Added **${colour.hex_code}** / **${colour.name}** to the Colour Bank as PENDING.\n\nThe Colour Bank Manager will review and approve it.`,
    metadata: { type: 'colour_added', hex_code: colour.hex_code, name: colour.name },
    chips: [
      { label: '🔍 Check another code', action: 'quick_check' },
      { label: '📝 Create a new PO', action: 'create_po' },
    ],
    intent: 'colour_added',
  };
}
