import { NextRequest, NextResponse } from 'next/server';
import { askAgent } from '@/lib/agent';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let question = '';
  try {
    const body = await req.json();
    question = String(body?.question ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: 'Falta la pregunta' }, { status: 400 });
  }

  try {
    const result = await askAgent(question);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/agent]', err);
    return NextResponse.json(
      { error: 'El agente tuvo un problema procesando tu pregunta.' },
      { status: 500 },
    );
  }
}
