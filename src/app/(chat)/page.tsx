'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, SuggestionChip, ValidationLine } from '@/types';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import SuggestionChips from '@/components/chat/SuggestionChips';

const HOME_CHIPS: SuggestionChip[] = [
  { label: '📄 Validate a PO (PDF/Doc)', action: 'upload_po' },
  { label: '🔍 Quick colour check', action: 'quick_check' },
  { label: '📝 Create a new PO', action: 'create_po' },
  { label: '📋 See my recent POs', action: 'recent_pos' },
];

type POStep =
  | 'vendor_name'
  | 'vendor_address'
  | 'vendor_contact'
  | 'delivery_date'
  | 'currency'
  | 'terms'
  | 'line_item'
  | 'more_items'
  | 'review'
  | null;

interface PODraftItem {
  acc_name: string;
  style_no: string;
  colour_code: string;
  colour_name: string;
  size: string;
  uom: string;
  qty: number;
  rate: number;
}

interface PODraft {
  vendor_name: string;
  vendor_address: string;
  vendor_email: string;
  vendor_gst: string;
  delivery_date: string;
  currency: string;
  conversion_rate: string;
  terms_of_delivery: string;
  pay_terms: string;
  line_items: PODraftItem[];
}

const EMPTY_DRAFT: PODraft = {
  vendor_name: '',
  vendor_address: '',
  vendor_email: '',
  vendor_gst: '',
  delivery_date: '',
  currency: 'INR',
  conversion_rate: '',
  terms_of_delivery: '',
  pay_terms: '',
  line_items: [],
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chips, setChips] = useState<SuggestionChip[]>(HOME_CHIPS);
  const [lastValidationLines, setLastValidationLines] = useState<ValidationLine[]>([]);
  const [poStep, setPoStep] = useState<POStep>(null);
  const [poDraft, setPoDraft] = useState<PODraft>(EMPTY_DRAFT);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function addBotMessage(content: string, newChips?: SuggestionChip[]) {
    const msg: Message = {
      id: Date.now() + 1,
      conversation_id: conversationId || 0,
      role: 'bot',
      content,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    if (newChips) setChips(newChips);
  }

  function addUserMessage(content: string) {
    const msg: Message = {
      id: Date.now(),
      conversation_id: conversationId || 0,
      role: 'user',
      content,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    setChips([]);
  }

  const STEP_ORDER: POStep[] = [
    'vendor_name', 'vendor_address', 'vendor_contact',
    'delivery_date', 'currency', 'terms', 'line_item',
  ];

  const STEP_LABELS: Record<string, string> = {
    vendor_name: 'Vendor Name',
    vendor_address: 'Vendor Address',
    vendor_contact: 'Email & GST',
    delivery_date: 'Delivery Date',
    currency: 'Currency & Rate',
    terms: 'Terms',
  };

  function goBackStep() {
    if (!poStep) return;
    const idx = STEP_ORDER.indexOf(poStep);
    // Can't go back from first step
    if (idx <= 0) return;

    const prevStep = STEP_ORDER[idx - 1]!;
    setPoStep(prevStep);
    const label = STEP_LABELS[prevStep] || prevStep;
    addBotMessage(`Going back to **${label}**. Please re-enter your answer.`);
    promptForStep(prevStep);
  }

  function backChip(): SuggestionChip {
    return { label: 'Go back', action: '__go_back__' };
  }

  function promptForStep(step: POStep) {
    switch (step) {
      case 'vendor_name':
        setChips([
          { label: 'YKK (THAILAND) CO., LTD', action: 'YKK (THAILAND) CO., LTD' },
        ]);
        break;
      case 'vendor_address':
        setChips([backChip()]);
        break;
      case 'vendor_contact':
        setChips([{ label: '---, ---', action: '---, ---' }, backChip()]);
        break;
      case 'delivery_date':
        setChips([{ label: '---', action: '---' }, backChip()]);
        break;
      case 'currency':
        setChips([
          { label: 'INR', action: 'INR, 1' },
          { label: 'USD, 83', action: 'USD, 83' },
          { label: 'EUR, 89', action: 'EUR, 89' },
          backChip(),
        ]);
        break;
      case 'terms':
        setChips([{ label: '---, ---', action: '---, ---' }, backChip()]);
        break;
      case 'line_item':
        setChips([backChip()]);
        break;
      default:
        break;
    }
  }

  function startPOCreation() {
    setPoDraft({ ...EMPTY_DRAFT });
    setPoStep('vendor_name');
    addBotMessage(
      'Let\'s create a new PO. I\'ll walk you through step by step.\n\n**Step 1/6:** Who is the vendor?',
      [
        { label: 'YKK (THAILAND) CO., LTD', action: 'YKK (THAILAND) CO., LTD' },
      ]
    );
  }

  function handlePOStep(input: string) {
    // Handle "go back" from any step
    if (input === '__go_back__') {
      addUserMessage('Go back');
      goBackStep();
      return;
    }

    addUserMessage(input);

    switch (poStep) {
      case 'vendor_name':
        setPoDraft((d) => ({ ...d, vendor_name: input }));
        setPoStep('vendor_address');
        addBotMessage(
          `Vendor: **${input}**\n\n**Step 2/6:** What\'s the vendor\'s address?`,
          [backChip()]
        );
        break;

      case 'vendor_address':
        setPoDraft((d) => ({ ...d, vendor_address: input }));
        setPoStep('vendor_contact');
        addBotMessage(
          '**Step 3/6:** Vendor email and GST number?\n\nFormat: `email, GST` (type `---` for either if not applicable)',
          [{ label: '---, ---', action: '---, ---' }, backChip()]
        );
        break;

      case 'vendor_contact': {
        const parts = input.split(',').map((s) => s.trim());
        setPoDraft((d) => ({
          ...d,
          vendor_email: parts[0] || '---',
          vendor_gst: parts[1] || '---',
        }));
        setPoStep('delivery_date');
        addBotMessage('**Step 4/6:** Delivery date? (DD/MM/YYYY or type `---` if TBD)', [
          { label: '---', action: '---' },
          backChip(),
        ]);
        break;
      }

      case 'delivery_date':
        setPoDraft((d) => ({ ...d, delivery_date: input }));
        setPoStep('currency');
        addBotMessage(
          '**Step 5/6:** Currency and conversion rate?\n\nFormat: `CURRENCY, RATE` (e.g., `USD, 83`)',
          [
            { label: 'INR', action: 'INR, 1' },
            { label: 'USD, 83', action: 'USD, 83' },
            { label: 'EUR, 89', action: 'EUR, 89' },
            backChip(),
          ]
        );
        break;

      case 'currency': {
        const cparts = input.split(',').map((s) => s.trim());
        setPoDraft((d) => ({
          ...d,
          currency: cparts[0]?.toUpperCase() || 'INR',
          conversion_rate: cparts[1] || '1',
        }));
        setPoStep('terms');
        addBotMessage(
          '**Step 6/6:** Terms of delivery and pay terms?\n\nFormat: `delivery terms, pay terms` (type `---` if not applicable)',
          [{ label: '---, ---', action: '---, ---' }, backChip()]
        );
        break;
      }

      case 'terms': {
        const tparts = input.split(',').map((s) => s.trim());
        setPoDraft((d) => ({
          ...d,
          terms_of_delivery: tparts[0] || '---',
          pay_terms: tparts[1] || '---',
        }));
        setPoStep('line_item');
        addBotMessage(
          'Header details captured. Now let\'s add **line items**.\n\nFor each item, enter in this format:\n`ACC NAME, OC/STYLE NO, SHADE NO, COLOUR/SIZE, UOM, QTY, RATE`\n\nExample:\n`PRONGS, PK/25-26/E/1816/H44211, FFCFCF, CRYSTAL PINK/15L, NOS, 220450, 0.0041`',
          [backChip()]
        );
        break;
      }

      case 'line_item': {
        const fields = input.split(',').map((s) => s.trim());
        if (fields.length < 6) {
          addBotMessage(
            'Please provide at least 6 fields:\n`ACC NAME, STYLE NO, SHADE NO, COLOUR/SIZE, UOM, QTY`\n\nRATE is optional.',
            [backChip()]
          );
          return;
        }
        const item: PODraftItem = {
          acc_name: fields[0],
          style_no: fields[1],
          colour_code: fields[2],
          colour_name: fields[3]?.split('/')[0]?.trim() || '',
          size: fields[3]?.split('/')?.slice(1)?.join('/')?.trim() || '',
          uom: fields[4]?.toUpperCase() || 'NOS',
          qty: parseInt(fields[5]) || 0,
          rate: parseFloat(fields[6]) || 0,
        };
        setPoDraft((d) => ({ ...d, line_items: [...d.line_items, item] }));
        setPoStep('more_items');
        addBotMessage(
          `Added line ${poDraft.line_items.length + 1}: **${item.acc_name}** — ${item.colour_code} (${item.colour_name}) x ${item.qty} ${item.uom}\n\nAdd another line item, or type **done** to review.`,
          [
            { label: 'Done — review PO', action: 'done' },
            { label: 'Undo last item', action: '__undo_item__' },
          ]
        );
        break;
      }

      case 'more_items': {
        if (input.toLowerCase() === 'done') {
          handlePOReview();
          return;
        }
        if (input === '__undo_item__') {
          setPoDraft((d) => ({ ...d, line_items: d.line_items.slice(0, -1) }));
          const remaining = poDraft.line_items.length - 1;
          addBotMessage(
            `Removed last line item. ${remaining > 0 ? `You have ${remaining} item${remaining > 1 ? 's' : ''}.` : 'No items yet.'}\n\nEnter a line item or type **done** to review.`,
            [
              ...(remaining > 0 ? [{ label: 'Done — review PO', action: 'done' }] : []),
              backChip(),
            ]
          );
          setPoStep('line_item');
          return;
        }
        // Treat as another line item
        setPoStep('line_item');
        handlePOStep(input);
        break;
      }

      default:
        break;
    }
  }

  async function handlePOReview() {
    if (poDraft.line_items.length === 0) {
      addBotMessage('You haven\'t added any line items yet. Please add at least one.');
      setPoStep('line_item');
      return;
    }

    setLoading(true);

    // Validate colours against the Colour Bank
    try {
      const res = await fetch('/api/colours/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: poDraft.line_items.map((item, i) => ({
            sno: i + 1,
            colour_code: item.colour_code,
            colour_name: item.colour_name,
          })),
        }),
      });
      const data = await res.json();

      let summary = `**PO Review**\n\n`;
      summary += `**Vendor:** ${poDraft.vendor_name}\n`;
      summary += `**Address:** ${poDraft.vendor_address}\n`;
      if (poDraft.vendor_email !== '---') summary += `**Email:** ${poDraft.vendor_email}\n`;
      if (poDraft.vendor_gst !== '---') summary += `**GST:** ${poDraft.vendor_gst}\n`;
      summary += `**Delivery:** ${poDraft.delivery_date}\n`;
      summary += `**Currency:** ${poDraft.currency}`;
      if (poDraft.conversion_rate && poDraft.conversion_rate !== '1') summary += ` (Rate: ${poDraft.conversion_rate})`;
      summary += `\n\n`;

      summary += `**Line Items (${poDraft.line_items.length}):**\n`;
      poDraft.line_items.forEach((item, i) => {
        const vResult = data.results?.[i];
        const icon = !vResult ? '' : vResult.verdict === 'VALID' ? '✅' : vResult.verdict === 'NAME_MISMATCH' ? '⚠️' : '❌';
        summary += `${i + 1}. ${icon} ${item.acc_name} — ${item.colour_code} / ${item.colour_name} — ${item.qty} ${item.uom}\n`;
      });

      if (data.summary) {
        summary += `\n**Colour Validation:** ${data.summary.valid} valid`;
        if (data.summary.mismatches > 0) summary += `, ${data.summary.mismatches} mismatches`;
        if (data.summary.unknown > 0) summary += `, ${data.summary.unknown} unknown`;
        if (data.summary.pending > 0) summary += `, ${data.summary.pending} pending`;
      }

      setLastValidationLines(data.results || []);

      const reviewChips: SuggestionChip[] = [];
      if (data.summary?.unknown > 0) {
        reviewChips.push({ label: 'Add unknown colours to Bank', action: 'add_unknown_colours' });
      }
      if (!data.summary?.hasErrors) {
        reviewChips.push({ label: 'Submit PO', action: 'po_create_submit' });
      }
      reviewChips.push({ label: 'Cancel', action: 'po_create_cancel' });

      const botMsg: Message = {
        id: Date.now() + 1,
        conversation_id: conversationId || 0,
        role: 'bot',
        content: summary,
        metadata: data.results ? { type: 'validation_result', lines: data.results } : null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setChips(reviewChips);
      setPoStep('review');
    } catch {
      addBotMessage('Sorry, colour validation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePOCreateSubmit() {
    setLoading(true);
    setChips([]);
    addUserMessage('Submit this PO');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__submit_po__',
          conversationId,
          lineItems: poDraft.line_items.map((item, i) => {
            const vLine = lastValidationLines[i];
            return {
              acc_name: item.acc_name,
              style_no: item.style_no,
              colour_code: item.colour_code,
              colour_name: vLine?.official_name || item.colour_name,
              size: item.size,
              uom: item.uom,
              qty: item.qty,
              rate: item.rate,
              validation_status: vLine?.verdict || 'VALID',
            };
          }),
          poDraft: {
            vendor_name: poDraft.vendor_name,
            vendor_address: poDraft.vendor_address,
            vendor_email: poDraft.vendor_email === '---' ? null : poDraft.vendor_email,
            vendor_gst: poDraft.vendor_gst === '---' ? null : poDraft.vendor_gst,
            delivery_date: poDraft.delivery_date === '---' ? null : poDraft.delivery_date,
            currency: poDraft.currency,
            conversion_rate: parseFloat(poDraft.conversion_rate) || null,
            terms_of_delivery: poDraft.terms_of_delivery === '---' ? null : poDraft.terms_of_delivery,
            pay_terms: poDraft.pay_terms === '---' ? null : poDraft.pay_terms,
          },
        }),
      });
      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);

      const botMsg: Message = {
        id: Date.now() + 1,
        conversation_id: data.conversationId || 0,
        role: 'bot',
        content: data.reply,
        metadata: data.metadata || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      if (data.chips) setChips(data.chips);

      // Reset PO creation state
      setPoStep(null);
      setPoDraft({ ...EMPTY_DRAFT });
      setLastValidationLines([]);
    } catch {
      addBotMessage('Sorry, something went wrong submitting the PO.');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(content: string) {
    // If we're in PO creation mode, route through the step handler
    if (poStep) {
      handlePOStep(content);
      return;
    }

    // Add user message to UI
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: conversationId || 0,
      role: 'user',
      content,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setChips([]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId,
        }),
      });

      const data = await res.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Add bot response
      const botMsg: Message = {
        id: Date.now() + 1,
        conversation_id: data.conversationId || 0,
        role: 'bot',
        content: data.reply,
        metadata: data.metadata || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);

      // Set suggestion chips if provided
      if (data.chips) {
        setChips(data.chips);
      }
    } catch {
      const errorMsg: Message = {
        id: Date.now() + 1,
        conversation_id: 0,
        role: 'bot',
        content: 'Sorry, something went wrong. Please try again.',
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUnknownColours() {
    const unknowns = lastValidationLines.filter((l) => l.verdict === 'UNKNOWN_CODE');
    if (unknowns.length === 0) return;

    setLoading(true);
    setChips([]);

    const userMsg: Message = {
      id: Date.now(),
      conversation_id: conversationId || 0,
      role: 'user',
      content: `Add ${unknowns.length} unknown colour${unknowns.length > 1 ? 's' : ''} to the Colour Bank`,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__add_unknown_colours__',
          conversationId,
          unknownLines: unknowns.map((l) => ({
            hex_code: l.colour_code,
            name: l.entered_name,
          })),
        }),
      });
      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);

      // Update local validation lines — mark previously unknown as PENDING
      setLastValidationLines((prev) =>
        prev.map((l) =>
          l.verdict === 'UNKNOWN_CODE'
            ? { ...l, verdict: 'PENDING_COLOUR' as const, status: 'PENDING' as const }
            : l
        )
      );

      const botMsg: Message = {
        id: Date.now() + 1,
        conversation_id: data.conversationId || 0,
        role: 'bot',
        content: data.reply,
        metadata: data.metadata || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      if (data.chips) setChips(data.chips);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, conversation_id: 0, role: 'bot' as const, content: 'Sorry, something went wrong adding the colours.', metadata: null, created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitPO() {
    if (lastValidationLines.length === 0) return;

    setLoading(true);
    setChips([]);

    const userMsg: Message = {
      id: Date.now(),
      conversation_id: conversationId || 0,
      role: 'user',
      content: 'Submit this PO for approval',
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__submit_po__',
          conversationId,
          lineItems: lastValidationLines.map((l) => ({
            colour_code: l.colour_code,
            colour_name: l.official_name || l.entered_name,
            qty: 1,
            validation_status: l.verdict,
          })),
        }),
      });
      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);

      const botMsg: Message = {
        id: Date.now() + 1,
        conversation_id: data.conversationId || 0,
        role: 'bot',
        content: data.reply,
        metadata: data.metadata || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      if (data.chips) setChips(data.chips);
      setLastValidationLines([]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, conversation_id: 0, role: 'bot' as const, content: 'Sorry, something went wrong submitting the PO.', metadata: null, created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleChipSelect(action: string) {
    if (action === 'add_unknown_colours') {
      handleAddUnknownColours();
      return;
    }
    if (action === 'submit_po') {
      handleSubmitPO();
      return;
    }
    if (action === 'po_create_submit') {
      handlePOCreateSubmit();
      return;
    }
    if (action === 'po_create_cancel') {
      setPoStep(null);
      setPoDraft({ ...EMPTY_DRAFT });
      addUserMessage('Cancel PO creation');
      addBotMessage('PO creation cancelled. How can I help you?', HOME_CHIPS);
      return;
    }
    if (action === 'create_po') {
      addUserMessage('I want to create a new PO');
      startPOCreation();
      return;
    }
    // If in PO creation mode, route chip actions through step handler
    if (poStep) {
      handlePOStep(action);
      return;
    }
    const chipLabels: Record<string, string> = {
      upload_po: 'I want to validate an existing PO document',
      quick_check: 'Quick colour check',
      recent_pos: 'Show me my recent POs',
    };
    sendMessage(chipLabels[action] || action);
  }

  async function handleFileUpload(file: File) {
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: conversationId || 0,
      role: 'user',
      content: `📎 Uploaded: ${file.name}`,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setChips([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (conversationId) {
        formData.append('conversationId', String(conversationId));
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Store validation lines for follow-up actions
      if (data.metadata?.type === 'validation_result' && data.metadata.lines) {
        setLastValidationLines(data.metadata.lines);
      }

      const botMsg: Message = {
        id: Date.now() + 1,
        conversation_id: data.conversationId || 0,
        role: 'bot',
        content: data.reply,
        metadata: data.metadata || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);

      if (data.chips) {
        setChips(data.chips);
      }
    } catch {
      const errorMsg: Message = {
        id: Date.now() + 1,
        conversation_id: 0,
        role: 'bot',
        content: 'Sorry, I could not process that file. Please try again.',
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {isEmpty && (
            <div className="text-center mt-20">
              <div className="w-16 h-16 bg-[#155387] rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white font-bold text-2xl">P</span>
              </div>
              <h2 className="text-2xl font-semibold text-[#155387] mb-2">
                Hi, how can I help with your POs today?
              </h2>
              <p className="text-[#787878] mb-8">
                Validate colours, check codes, or create a new Purchase Order.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatest={i === messages.length - 1}
            />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#155387] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">P</span>
              </div>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#155387]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#155387]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#155387]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Suggestion chips */}
          {!loading && chips.length > 0 && (
            <div className={isEmpty ? 'flex justify-center' : ''}>
              <SuggestionChips chips={chips} onSelect={handleChipSelect} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onFileUpload={handleFileUpload}
        disabled={loading}
      />
    </div>
  );
}
