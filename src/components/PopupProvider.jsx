import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react';

const PopupContext = createContext(null);

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};

export const PopupProvider = ({ children }) => {
  const [popup, setPopup] = useState(null);

  const showAlert = (title, status = 'success', message = '') => {
    return new Promise((resolve) => {
      setPopup({
        type: 'alert',
        title,
        message,
        status,
        resolve,
      });
    });
  };

  const showConfirm = (title, message = '') => {
    return new Promise((resolve) => {
      setPopup({
        type: 'confirm',
        title,
        message,
        status: 'confirm',
        resolve,
      });
    });
  };

  const handleAction = (value) => {
    if (popup?.resolve) {
      popup.resolve(value);
    }
    setPopup(null);
  };

  // ดึงไอคอนและสีที่เหมาะสมตามสถานะ
  const getStatusDetails = (status) => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-12 h-12 text-emerald-500" />,
          accentColor: 'border-emerald-500',
          btnBg: 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-200',
        };
      case 'error':
        return {
          icon: <XCircle className="w-12 h-12 text-rose-500" />,
          accentColor: 'border-rose-500',
          btnBg: 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-200',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
          accentColor: 'border-amber-500',
          btnBg: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-200',
        };
      case 'confirm':
        return {
          icon: <HelpCircle className="w-12 h-12 text-orange-500" />,
          accentColor: 'border-orange-500',
          btnBg: 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-200',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-12 h-12 text-sky-500" />,
          accentColor: 'border-sky-500',
          btnBg: 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-200',
        };
    }
  };

  const details = popup ? getStatusDetails(popup.status) : null;

  return (
    <PopupContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      <AnimatePresence>
        {popup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => popup.type === 'alert' && handleAction(true)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-md bg-white border border-slate-100/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center z-10"
            >
              {/* Icon Container */}
              <div className="mb-4 bg-slate-50 p-4 rounded-full shadow-inner">
                {details?.icon}
              </div>

              {/* Title & Message */}
              <h3 className="text-lg font-black text-slate-800 leading-snug tracking-tight mb-2">
                {popup.title}
              </h3>
              {popup.message && (
                <p className="text-sm text-slate-500 font-semibold mb-6">
                  {popup.message}
                </p>
              )}

              {/* Buttons Actions */}
              <div className="flex gap-3 w-full mt-2">
                {popup.type === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction(false)}
                      className="flex-1 py-3 px-5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-2xl transition-all active:scale-[0.98] outline-none text-xs tracking-wider"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(true)}
                      className={`flex-1 py-3 px-5 text-white font-bold rounded-2xl transition-all active:scale-[0.98] outline-none shadow-md ${details?.btnBg} text-xs tracking-wider`}
                    >
                      ยืนยัน
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAction(true)}
                    className={`w-full py-3 px-5 text-white font-bold rounded-2xl transition-all active:scale-[0.98] outline-none shadow-md ${details?.btnBg} text-xs tracking-wider`}
                  >
                    ตกลง
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PopupContext.Provider>
  );
};
