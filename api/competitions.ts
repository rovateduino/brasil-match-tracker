import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware, sendSuccess } from './lib/shared';

const COMPETITIONS = [
  { id: 71, name: 'Brasileirão Série A', type: 'national', country: 'Brazil' },
  { id: 72, name: 'Brasileirão Série B', type: 'national', country: 'Brazil' },
  { id: 73, name: 'Copa do Brasil', type: 'national', country: 'Brazil' },
  { id: 13, name: 'Libertadores da América', type: 'international', country: 'South America' },
  { id: 11, name: 'Copa Sul-Americana', type: 'international', country: 'South America' },
  { id: 2, name: 'UEFA Champions League', type: 'international', country: 'Europe' },
  { id: 39, name: 'Premier League', type: 'national', country: 'England' },
  { id: 140, name: 'La Liga', type: 'national', country: 'Spain' },
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyMiddleware(req, res)) return;
  sendSuccess(res, COMPETITIONS);
}
