import { ValidationLine } from '@/types';
import ColorSwatch from './ColorSwatch';

export default function ValidationCard({ lines }: { lines: ValidationLine[] }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mt-2">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700">Validation Summary</h4>
      </div>
      <div className="divide-y divide-gray-100">
        {lines.map((line) => (
          <div key={line.sno} className="px-4 py-3 flex items-center gap-3">
            {/* Status icon */}
            <span className="flex-shrink-0">
              {line.verdict === 'VALID' && (
                <span className="text-[#348734]">✅</span>
              )}
              {line.verdict === 'NAME_MISMATCH' && (
                <span className="text-[#9c5300]">⚠️</span>
              )}
              {(line.verdict === 'UNKNOWN_CODE' || line.verdict === 'PENDING_COLOUR') && (
                <span className="text-[#942e2e]">❌</span>
              )}
            </span>

            {/* Swatch */}
            <ColorSwatch hexCode={line.colour_code} size="sm" />

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">
                Line {line.sno}: {line.colour_code}
              </div>
              <div className="text-xs text-gray-500">
                {line.verdict === 'VALID' && (
                  <>Entered: {line.entered_name} — Matches {line.official_name}</>
                )}
                {line.verdict === 'NAME_MISMATCH' && (
                  <>
                    Entered: <span className="text-[#9c5300]">{line.entered_name}</span> — Should
                    be: <span className="font-medium">{line.official_name}</span>
                  </>
                )}
                {line.verdict === 'UNKNOWN_CODE' && (
                  <>Code not found in Colour Bank</>
                )}
                {line.verdict === 'PENDING_COLOUR' && (
                  <>Pending approval — {line.entered_name}</>
                )}
              </div>
            </div>

            {/* Status badge */}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                line.verdict === 'VALID'
                  ? 'bg-green-50 text-[#348734]'
                  : line.verdict === 'NAME_MISMATCH'
                  ? 'bg-orange-50 text-[#9c5300]'
                  : 'bg-red-50 text-[#942e2e]'
              }`}
            >
              {line.verdict === 'VALID'
                ? 'Valid'
                : line.verdict === 'NAME_MISMATCH'
                ? 'Mismatch'
                : line.verdict === 'PENDING_COLOUR'
                ? 'Pending'
                : 'Unknown'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
