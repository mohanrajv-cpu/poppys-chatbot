'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, SuggestionChip } from '@/types';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import SuggestionChips from '@/components/chat/SuggestionChips';

const HOME_CHIPS: SuggestionChip[] = [
  { label: '📄 Validate a PO (PDF/Doc)', action: 'upload_po' },
  { label: '🔍 Quick colour check', action: 'quick_check' },
  { label: '📝 Create a new PO', action: 'create_po' },
  { label: '📋 See my recent POs', action: 'recent_pos' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chips, setChips] = useState<SuggestionChip[]>(HOME_CHIPS);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(content: string) {
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

  function handleChipSelect(action: string) {
    const chipLabels: Record<string, string> = {
      upload_po: 'I want to validate an existing PO document',
      quick_check: 'Quick colour check',
      create_po: 'I want to create a new PO',
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
