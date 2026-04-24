import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md min-w-[300px] max-w-md ${
                t.type === 'success' 
                  ? 'border-green-500/20 bg-green-50/90 text-green-900 dark:bg-green-950/90 dark:text-green-100'
                  : t.type === 'error'
                  ? 'border-red-500/20 bg-red-50/90 text-red-900 dark:bg-red-950/90 dark:text-red-100'
                  : 'border-border bg-card/90 text-foreground'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
              {t.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
              {t.type === 'info' && <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />}
              
              <span className="flex-1 text-sm font-medium">{t.message}</span>
              
              <button 
                onClick={() => removeToast(t.id)} 
                className="text-muted-foreground hover:text-foreground outline-none"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
