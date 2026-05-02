'use client';

import { Message } from '@/types';
import { useTypewriter } from '@/hooks/useTypewriter';
import ValidationCard from '../po/ValidationCard';
import ColorSwatch from '../po/ColorSwatch';

export default function MessageBubble({
  message,
  isLatest,
}: {
  message: Message;
  isLatest: boolean;
}) {
  const isUser = message.role === 'user';
  const shouldAnimate = !isUser && isLatest;
  const { displayedText, isComplete, skip } = useTypewriter(
    message.content,
    shouldAnimate
  );

  const text = shouldAnimate ? displayedText : message.content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* Bot avatar */}
      {!isUser && (
        <div className="w-8 h-8 bg-[#155387] rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1">
          <span className="text-white text-xs font-bold">P</span>
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        {/* Message content */}
        <div
          className={`${
            isUser
              ? 'bg-[#b8dfff] text-gray-900 rounded-2xl px-4 py-3'
              : 'text-gray-900'
          }`}
          onClick={shouldAnimate && !isComplete ? skip : undefined}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
          {!isComplete && !isUser && (
            <span className="inline-block w-0.5 h-4 bg-[#155387] animate-pulse ml-0.5" />
          )}
        </div>

        {/* Rich metadata content */}
        {isComplete && message.metadata && (
          <div className="mt-2">
            {message.metadata.type === 'validation_result' && (
              <ValidationCard lines={message.metadata.lines} />
            )}
            {message.metadata.type === 'colour_added' && (
              <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg text-sm">
                <ColorSwatch hexCode={message.metadata.hex_code} />
                <span className="text-[#348734]">
                  Added {message.metadata.hex_code} / {message.metadata.name} as PENDING
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 bg-[#155387] rounded-full flex items-center justify-center ml-3 flex-shrink-0 mt-1">
          <span className="text-white text-xs font-bold">U</span>
        </div>
      )}
    </div>
  );
}
