/**
 * 搜尋元件 — 搜尋股票代碼或名稱
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStocks } from '../services/api';
import type { StockInfo } from '../types';

interface SearchBarProps {
    className?: string;
}

export default function SearchBar({ className = '' }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<StockInfo[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // 搜尋
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setIsOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            const res = await searchStocks(query.trim());
            setResults(res.slice(0, 8));
            setIsOpen(res.length > 0);
            setSelectedIdx(-1);
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);

    // 鍵盤導航
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIdx >= 0) {
                    goToStock(results[selectedIdx].stock_id);
                } else if (results.length > 0) {
                    goToStock(results[0].stock_id);
                } else if (query.trim().match(/^\d{4}$/)) {
                    // 直接輸入 4 碼股票代碼
                    goToStock(query.trim());
                }
            } else if (e.key === 'Escape') {
                setIsOpen(false);
            }
        },
        [results, selectedIdx]
    );

    const goToStock = (stockId: string) => {
        setIsOpen(false);
        setQuery('');
        navigate(`/stock/${stockId}`);
    };

    // 點擊外部關閉
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
                    🔍
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="搜尋股票代碼或名稱... (例: 2330 台積電)"
                    className="search-input pl-10 text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query && results.length > 0 && setIsOpen(true)}
                />
            </div>

            {/* 搜尋結果下拉 */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                    {results.map((stock, idx) => (
                        <button
                            key={stock.stock_id}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${idx === selectedIdx
                                ? 'bg-primary-50 dark:bg-primary-900/20'
                                : 'hover:bg-surface-50 dark:hover:bg-surface-850'
                                }`}
                            onClick={() => goToStock(stock.stock_id)}
                            onMouseEnter={() => setSelectedIdx(idx)}
                        >
                            <span className="font-mono font-bold text-primary-600 dark:text-primary-400 w-14">
                                {stock.stock_id}
                            </span>
                            <span className="font-medium text-surface-900 dark:text-white">
                                {stock.stock_name}
                            </span>
                            <span className="ml-auto text-xs text-surface-400">
                                {stock.industry_category}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
