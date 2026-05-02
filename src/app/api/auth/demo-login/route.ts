import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { User, UserRole } from '@/types';

const DEMO_USERS: { name: string; email: string; role: UserRole }[] = [
  { name: 'Priya (PO Creator)', email: 'priya@poppys.demo', role: 'po_creator' },
  { name: 'Kavitha (Colour Manager)', email: 'kavitha@poppys.demo', role: 'colour_manager' },
  { name: 'Rajan (PO Approver)', email: 'rajan@poppys.demo', role: 'po_approver' },
];

export async function POST(request: NextRequest) {
  try {
    const { role } = await request.json();

    const demoUser = DEMO_USERS.find((u) => u.role === role);
    if (!demoUser) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if demo user exists, create if not
    let result = await sql`SELECT * FROM users WHERE email = ${demoUser.email}`;

    if (result.rows.length === 0) {
      const hash = await bcrypt.hash('demo123', 10);
      result = await sql`
        INSERT INTO users (email, name, password_hash, role)
        VALUES (${demoUser.email}, ${demoUser.name}, ${hash}, ${demoUser.role})
        RETURNING *
      `;
    }

    const user = result.rows[0] as User;
    await createSession(user);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Demo login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
