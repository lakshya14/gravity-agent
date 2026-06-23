import { marked } from 'marked';

/**
 * Formats a number as a US currency string.
 * @param amount The numeric amount to format.
 * @returns A formatted currency string (e.g., "$1,234.56") or "-" if null.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * Formats a date string into a localized date string.
 * @param dateStr The date string to format (e.g., "2023-10-27").
 * @returns A formatted date string or "-" if invalid/null.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Formats a Date object into a localized time string (HH:MM AM/PM).
 * @param date The Date object to format.
 * @returns A formatted time string.
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Parses markdown text and returns raw HTML.
 * @param text The markdown string to parse.
 * @returns Parsed HTML string.
 */
export function renderMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return marked.parse(text) as string;
}
