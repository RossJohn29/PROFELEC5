import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Global theme bootstrapper to ensure consistent dark mode across refresh/navigation
function ThemeBootstrap({ children }) {
  useEffect(() => {
    const applyTheme = () => {
      const t = (localStorage.getItem('theme') || 'light').toLowerCase();
      if (t === 'dark') {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.remove('theme-dark');
      }
    };

    // Apply immediately and on changes
    applyTheme();
    const onStorage = (e) => {
      if (!e || e.key === 'theme') applyTheme();
    };
    const onThemeChange = () => applyTheme();

    window.addEventListener('storage', onStorage);
    window.addEventListener('themeChange', onThemeChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('themeChange', onThemeChange);
    };
  }, []);

  return children;
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeBootstrap>
      <App />
    </ThemeBootstrap>
  </StrictMode>,
)
