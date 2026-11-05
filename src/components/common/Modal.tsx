import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  ariaLabel?: string;
}

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  ariaLabel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${MAX_WIDTH_CLASSES[maxWidth]} rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] transition-all`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-5 py-3.5 shrink-0 bg-[#FFFFFF] dark:bg-[#20231F]">
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] transition-colors focus:outline-none focus:ring-2 focus:ring-[#526B55]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
