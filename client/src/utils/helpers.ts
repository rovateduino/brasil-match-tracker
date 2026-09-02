import { Match } from '@/types';

export const parseDate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDate = (iso: string): string => {
  return parseDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const isToday = (iso: string): boolean => {
  const date = parseDate(iso);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export const groupMatchesByDate = (matches: Match[]): Record<string, Match[]> => {
  return matches.reduce((acc, match) => {
    const key = match.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, Match[]>);
};