import { NextRequest } from 'next/server';
import worker from '../src/worker';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Pass the web request and process.env environment variables directly to our unified worker
  return worker.fetch(request, process.env as Record<string, string | undefined>);
}

export async function GET(request: NextRequest) {
  return worker.fetch(request, process.env as Record<string, string | undefined>);
}

export async function OPTIONS() {
  const req = new Request('https://localhost/', { method: 'OPTIONS' });
  return worker.fetch(req, {});
}
