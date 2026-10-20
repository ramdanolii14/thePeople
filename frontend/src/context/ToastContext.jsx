import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
let toastSequence = 0;

const toastStyles = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 text-emerald-800',
    iconClassName: 'text-emerald-600'
  },
  error: {
    icon: AlertCircle,
    className: 'border-red-200 text-red-800',
    iconClassName: 'text-red-600'
  },
  info: {
    icon: Info,
    className: 'border-gray-200 text-gray-800',
    iconClassName: 'text-blue-600'
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastSequence;
    setToasts((current) => [...current, { id, message, type }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((toast) => {
          const style = toastStyles[toast.type] || toastStyles.info;
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={'flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg ' + style.className}
            >
              <Icon className={'mt-0.5 h-5 w-5 shrink-0 ' + style.iconClassName} aria-hidden="true" />
              <p className="flex-1 text-sm leading-5">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Tutup notifikasi"
                className="rounded-md p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast harus digunakan di dalam ToastProvider.');
  }
  return context;
}
