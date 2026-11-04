import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { placePopover, type PopoverPlacement } from '../../lib/popover';

interface AnchoredPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const AnchoredPopover: React.FC<AnchoredPopoverProps> = ({
  anchorRef,
  open,
  onClose,
  title,
  children,
  className = '',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const lastWidthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Measure and position
  const updatePosition = () => {
    if (!open || !anchorRef.current || !popoverRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const size = {
      width: popoverRect.width || 240,
      height: popoverRect.height || 180,
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const next = placePopover(anchorRect, size, viewport);
    setPlacement(next);
  };

  useLayoutEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      updatePosition();
    }
  }, [open]);

  // Focus management: focus popover without scrolling
  useEffect(() => {
    if (open && popoverRef.current) {
      const focusable = popoverRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus({ preventScroll: true });
      } else {
        popoverRef.current.focus({ preventScroll: true });
      }
    }
    return () => {
      if (previouslyFocusedRef.current) {
        try {
          previouslyFocusedRef.current.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }
    };
  }, [open]);

  // Handle escape, outside click, resize and scroll
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth !== lastWidthRef.current) {
        // Width change (e.g. orientation change or window resize) -> close
        lastWidthRef.current = currentWidth;
        onClose();
      } else {
        // Height-only resize (e.g. on-screen keyboard appearing on mobile) -> re-measure
        updatePosition();
      }
    };

    const handleScroll = (e: Event) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const isSheet = placement?.isSheet ?? (window.innerWidth < 480);
  const style: React.CSSProperties = isSheet
    ? {
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: 8,
        width: 'auto',
        maxHeight: 'calc(100dvh - 2rem)',
        zIndex: 80,
      }
    : placement
    ? {
        position: 'fixed',
        left: placement.x,
        top: placement.y,
        width: placement.width,
        zIndex: 80,
      }
    : {
        position: 'fixed',
        visibility: 'hidden',
        zIndex: 80,
      };

  const content = (
    <>
      {isSheet && (
        <div
          className="fixed inset-0 z-[79] bg-black/40 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal={isSheet}
        aria-label={title || 'Dialog'}
        tabIndex={-1}
        style={style}
        className={`rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xl text-[#252821] dark:text-[#ECEDE6] focus:outline-none ${className}`}
      >
        {isSheet && (
          <div className="mb-2 flex items-center justify-between border-b border-[#ECEDE7] dark:border-[#2A2E28] pb-1.5">
            <span className="text-xs font-bold">{title || 'Options'}</span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  );

  return createPortal(content, document.body);
};
