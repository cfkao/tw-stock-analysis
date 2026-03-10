/**
 * 自選股服務 — localStorage 持久化
 */

const WATCHLIST_KEY = 'tw_stock_watchlist';
const NOTES_KEY = 'tw_stock_notes';

// === 自選股 ===

export function getWatchlist(): string[] {
    try {
        const raw = localStorage.getItem(WATCHLIST_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function addToWatchlist(stockId: string): string[] {
    const list = getWatchlist();
    if (!list.includes(stockId)) {
        list.unshift(stockId);
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
    }
    return list;
}

export function removeFromWatchlist(stockId: string): string[] {
    const list = getWatchlist().filter((id) => id !== stockId);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
    return list;
}

export function isInWatchlist(stockId: string): boolean {
    return getWatchlist().includes(stockId);
}

// === 個股筆記 ===

export interface StockNote {
    content: string;
    updatedAt: string;
}

export function getNote(stockId: string): StockNote | null {
    try {
        const raw = localStorage.getItem(`${NOTES_KEY}_${stockId}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveNote(stockId: string, content: string): StockNote {
    const note: StockNote = { content, updatedAt: new Date().toISOString() };
    localStorage.setItem(`${NOTES_KEY}_${stockId}`, JSON.stringify(note));
    return note;
}

export function deleteNote(stockId: string): void {
    localStorage.removeItem(`${NOTES_KEY}_${stockId}`);
}
