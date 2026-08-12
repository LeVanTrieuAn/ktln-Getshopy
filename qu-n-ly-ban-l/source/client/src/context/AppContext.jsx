import { createContext, useContext, useState } from 'react';
import vi from '../i18n/vi';
import en from '../i18n/en';

const translations = { vi, en };

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'vi');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme') === 'dark';
    document.documentElement.setAttribute('data-theme', saved ? 'dark' : 'light');
    return saved;
  });
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [b2cUser, setB2cUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('b2c_user')); } catch { return null; }
  });
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('b2c_wishlist')) || []; } catch { return []; }
  });
  const [compareList, setCompareList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('b2c_compare')) || []; } catch { return []; }
  });
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('b2c_recent')) || []; } catch { return []; }
  });

  const toggleWishlist = (product) => {
    setWishlist(prev => {
      const exists = prev.find(p => p.id === product.id);
      const next = exists ? prev.filter(p => p.id !== product.id) : [product, ...prev];
      localStorage.setItem('b2c_wishlist', JSON.stringify(next));
      return next;
    });
  };

  const toggleCompare = (product) => {
    setCompareList(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) {
        const next = prev.filter(p => p.id !== product.id);
        localStorage.setItem('b2c_compare', JSON.stringify(next));
        return next;
      } else {
        if (prev.length >= 3) {
          throw new Error('Chỉ có thể so sánh tối đa 3 sản phẩm');
        }
        const next = [...prev, product];
        localStorage.setItem('b2c_compare', JSON.stringify(next));
        return next;
      }
    });
  };

  const addRecentlyViewed = (product) => {
    setRecentlyViewed(prev => {
      // Remove if exists to move it to the top
      let next = prev.filter(p => p.id !== product.id);
      // Add to beginning
      next = [product, ...next];
      // Keep only last 10
      if (next.length > 10) next = next.slice(0, 10);
      localStorage.setItem('b2c_recent', JSON.stringify(next));
      return next;
    });
  };

  const t = (key) => {
    const keys = key.split('.');
    let val = translations[lang];
    for (const k of keys) { val = val?.[k]; }
    return val || key;
  };

  const toggleLang = () => {
    const next = lang === 'vi' ? 'en' : 'vi';
    setLang(next);
    localStorage.setItem('lang', next);
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  };

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const b2cLogin = (userData, token) => {
    setB2cUser(userData);
    localStorage.setItem('b2c_user', JSON.stringify(userData));
    localStorage.setItem('b2c_token', token);
  };

  const [selectedBranch, setSelectedBranchState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('b2c_branch')) || { id: 'HCM001', name: 'HCM - Quận 1' };
    } catch {
      return { id: 'HCM001', name: 'HCM - Quận 1' };
    }
  });

  const setSelectedBranch = (branch) => {
    setSelectedBranchState(branch);
    localStorage.setItem('b2c_branch', JSON.stringify(branch));
  };

  const b2cLogout = () => {
    setB2cUser(null);
    localStorage.removeItem('b2c_user');
    localStorage.removeItem('b2c_token');
  };

  return (
    <AppContext.Provider value={{
      lang, isDark, toggleLang, toggleTheme, t, 
      user, login, logout,
      b2cUser, b2cLogin, b2cLogout,
      selectedBranch, setSelectedBranch,
      wishlist, toggleWishlist, compareList, toggleCompare, recentlyViewed, addRecentlyViewed
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
