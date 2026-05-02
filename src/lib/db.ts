import { sql } from '@vercel/postgres';

export { sql };

// Helper to run queries with error handling
export async function query<T>(
  queryText: string,
  values?: unknown[]
): Promise<T[]> {
  const result = await sql.query(queryText, values);
  return result.rows as T[];
}
