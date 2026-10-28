import { env } from 'cloudflare:workers';
import { handlePongRequest } from '../../../../server/pong-api.js';

export const dynamic = 'force-dynamic';
export function GET(request) { return handlePongRequest(request, env.DB); }
export function POST(request) { return handlePongRequest(request, env.DB); }
