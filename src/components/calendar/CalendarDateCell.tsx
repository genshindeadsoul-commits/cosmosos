import React, { useRef, useState } from 'react';
import { formatReadableDate } from '../../lib/dates';

export interface MultiDaySpan {
  id: string;
  title: string;
  color?: string;
  isStart: boolean;
  isEnd: boolean;
  isMiddle: boolean;
  allDay?: boolean;
}

interface CalendarDateCellProps {
  dateKey: string;
  dayNum: number;
  isToday: boolean;
  isSelected: boolean;
  hasItems: boolean;
  isCurrentMonth?: boolean;
  dayOfWeekIndex: number; // 0 for Mon, 6 for Sun
  multiDaySpans?: MultiDaySpan[];
  onSelectDate: (key: string) => void;
  onOpenDetails: (key: string) => void;
  compact?: boolean;
}

export const CalendarDateCell: React.FC<CalendarDateCellProps> = ({
  dateKey,
  dayNum,
  isToday,
  isSelected,
  hasItems,
  isCurrentMonth = true,
  dayOfWeekIndex,
  multiDaySpans = [],
  onSelectDate,
  onOpenDetails,
  compact = false,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    didLongPressRef.current = false;
    touchStartPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    setIsPressing(true);
    touchTimerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      setIsPressing(false);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(25);
        } catch {}
      }
      onOpenDetails(dateKey);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !touchTimerRef.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
    // Cancel long press when the user scrolls or moves finger beyond threshold
    if (dx > 10 || dy > 10) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
      setIsPressing(false);
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    setIsPressing(false);
    // If long press did not trigger, this was a short tap -> select date
    if (!didLongPressRef.current) {
      onSelectDate(dateKey);
    }
    touchStartPosRef.current = null;
  };

  const handleTouchCancel = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    setIsPressing(false);
    touchStartPosRef.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Single click selects the date
    onSelectDate(dateKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Double click opens Day Details
    e.preventDefault();
    onOpenDetails(dateKey);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onOpenDetails(dateKey);
    } else if (e.key === ' ') {
      e.preventDefault();
      onSelectDate(dateKey);
    }
  };

  const isMonday = dayOfWeekIndex === 0;
  const isSunday = dayOfWeekIndex === 6;

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onKeyDown={handleKeyDown}
      aria-label={`${dateKey}${hasItems ? ', has items' : ''}`}
      aria-current={isToday ? 'date' : undefined}
      aria-selected={isSelected}
      title={`${formatReadableDate(dateKey)} — Click to select, Double-click or Enter to open details`}
      className={`relative flex flex-col justify-between rounded-xl transition-all select-none min-w-0 w-full ${
        compact ? 'p-1 aspect-square text-xs' : 'p-1.5 sm:p-2 min-h-[58px] sm:min-h-[76px] text-xs'
      } ${
        isSelected
          ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-sm ring-2 ring-[#3D5240] dark:ring-[#A8BDA1]'
          : isToday
          ? 'bg-[#E8EEE6] dark:bg-[#303B2E]/60 ring-1.5 ring-[#3D5240] dark:ring-[#A8BDA1] text-[#1E3022] dark:text-[#ECEDE6]'
          : isCurrentMonth
          ? 'bg-[#FFFFFF] dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] border border-[#DFE1D9]/70 dark:border-[#383D35]/70'
          : 'bg-[#F9FAF8]/40 dark:bg-[#181A17]/40 text-[#8A8E85] dark:text-[#5E6457] border border-transparent opacity-60'
      } ${isPressing ? 'scale-95 ring-2 ring-[#526B55]' : ''}`}
    >
      {/* Top Header: Date number & Today dot */}
      <div className="flex items-center justify-between w-full">
        <span
          className={`font-semibold text-xs ${
            isSelected
              ? 'text-white'
              : isToday
              ? 'font-extrabold text-[#1E3022] dark:text-[#A8BDA1]'
              : ''
          }`}
        >
          {dayNum}
        </span>

        {/* Subtle Activity Dot for Single-Day Records */}
        {hasItems && multiDaySpans.length === 0 && (
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              isSelected ? 'bg-white' : 'bg-[#526B55] dark:bg-[#A8BDA1]'
            }`}
          />
        )}
      </div>

      {/* Multi-day Continuous Colored Ranges */}
      {multiDaySpans.length > 0 && (
        <div className="w-full space-y-1 mt-auto pt-1">
          {multiDaySpans.slice(0, compact ? 1 : 2).map((span) => {
            // Apply continuous rounded corners:
            // - Left rounded if start date or first column of week (Monday)
            // - Right rounded if end date or last column of week (Sunday)
            const roundLeft = span.isStart || isMonday;
            const roundRight = span.isEnd || isSunday;

            const radiusClass =
              roundLeft && roundRight
                ? 'rounded-md'
                : roundLeft
                ? 'rounded-l-md rounded-r-none'
                : roundRight
                ? 'rounded-r-md rounded-l-none'
                : 'rounded-none';

            const bgStyle = span.color
              ? { backgroundColor: span.color }
              : undefined;

            return (
              <div
                key={span.id}
                style={bgStyle}
                className={`h-3.5 sm:h-4 px-1 flex items-center text-[9px] sm:text-[10px] font-bold text-white overflow-hidden truncate transition-all shadow-2xs ${radiusClass} ${
                  !span.color ? 'bg-[#526B55] dark:bg-[#435946]' : ''
                }`}
                title={span.title}
              >
                {(span.isStart || isMonday) && (
                  <span className="truncate w-full leading-none">
                    {span.title}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
};
