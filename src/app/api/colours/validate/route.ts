import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateMultipleLines } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lines } = await request.json();

    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: 'Lines array is required' },
        { status: 400 }
      );
    }

    const results = await validateMultipleLines(lines);

    const allValid = results.every((r) => r.verdict === 'VALID');
    const hasPending = results.some((r) => r.verdict === 'PENDING_COLOUR');
    const hasErrors = results.some(
      (r) => r.verdict === 'NAME_MISMATCH' || r.verdict === 'UNKNOWN_CODE'
    );

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        valid: results.filter((r) => r.verdict === 'VALID').length,
        mismatches: results.filter((r) => r.verdict === 'NAME_MISMATCH').length,
        unknown: results.filter((r) => r.verdict === 'UNKNOWN_CODE').length,
        pending: results.filter((r) => r.verdict === 'PENDING_COLOUR').length,
        allValid,
        hasPending,
        hasErrors,
        canSubmit: !hasErrors, // Can submit if no mismatches or unknown (pending is OK)
      },
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
