/**
 * 台股價值投資分析系統 — 主應用程式
 * React Router + Dark Mode + 搜尋列 + 導覽列 + 手機底部 Tab
 */
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import StockDetail from './pages/StockDetail';
import Dashboard from './pages/Dashboard';
import BacktestPage from './pages/BacktestPage';
import WatchlistPage from './pages/WatchlistPage';
import ComparePage from './pages/ComparePage';
import './index.css';

// === 手機底部導航 ===
function MobileNav() {
  const location = useLocation();
  const tabs = [
    { to: '/', label: '首頁', icon: '🏠', match: (p: string) => p === '/' },
    { to: '/watchlist', label: '自選', icon: '⭐', match: (p: string) => p === '/watchlist' },
    { to: '/compare', label: '對比', icon: '⚖️', match: (p: string) => p === '/compare' },
    { to: '/backtest', label: '回測', icon: '🔬', match: (p: string) => p === '/backtest' },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-surface-900/90 backdrop-blur-md border-t border-surface-200 dark:border-surface-800 safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${active
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AppLayout() {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-md border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl sm:text-2xl">📈</span>
              <h1 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white hidden sm:block">
                台股價值分析
              </h1>
            </Link>

            {/* Search */}
            <SearchBar className="flex-1 max-w-lg mx-3 sm:mx-8" />

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/watchlist"
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-850 transition-colors"
              >
                ⭐ 自選
              </Link>
              <Link
                to="/compare"
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-850 transition-colors"
              >
                ⚖️ 對比
              </Link>
              <Link
                to="/backtest"
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-850 transition-colors"
              >
                🔬 回測
              </Link>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="btn-ghost text-xl p-2"
                title="切換深色模式"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>

            {/* Mobile dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="sm:hidden btn-ghost text-lg p-1.5"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content — 底部留空給手機 Tab */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 sm:pb-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:stockId" element={<StockDetail />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </main>

      {/* Footer (desktop only) */}
      <footer className="hidden sm:block border-t border-surface-200 dark:border-surface-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-surface-900/40 dark:text-surface-200/40">
            台股價值投資分析系統 v0.4.0 — 資料來源 FinMind API
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Tab */}
      <MobileNav />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
