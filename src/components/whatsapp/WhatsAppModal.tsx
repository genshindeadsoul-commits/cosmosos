import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  X,
  ExternalLink,
  Send,
  Phone,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const WhatsAppModal: React.FC = () => {
  const { isWhatsAppOpen, setWhatsAppOpen, whatsAppPrefill, tasks, showToast, addTask } = useApp();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (isWhatsAppOpen) {
      setPhoneNumber(whatsAppPrefill.phone || '');
      setMessage(whatsAppPrefill.text || '');
      setPhoneError('');
    }
  }, [isWhatsAppOpen, whatsAppPrefill]);

  if (!isWhatsAppOpen) return null;

  const getDigitsOnly = (raw: string): string => {
    const cleaned = raw.replace(/[^\d+]/g, '');
    return cleaned.replace(/\D/g, '');
  };

  const digits = getDigitsOnly(phoneNumber);
  const isValidPhone = digits.length >= 7;
  const encodedText = encodeURIComponent(message.trim());
  const targetUrl = isValidPhone
    ? `https://wa.me/${digits}${encodedText ? `?text=${encodedText}` : ''}`
    : '#';

  // Follow-up capture: a normal task (saved to your account) that carries the official chat link.
  const handleSaveFollowUp = () => {
    if (!isValidPhone) { setPhoneError('Enter a valid phone number with country code first.'); return; }
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    addTask({
      title: `WhatsApp follow-up: +${digits}`,
      description: `Chat link: https://wa.me/${digits}${message.trim() ? `\nDraft: ${message.trim()}` : ''}`,
      list: 'Inbox', priority: 'MEDIUM', status: 'todo', dueDate: today,
    });
    setPhoneError('');
  };

  const handleLaunchClick = (e: React.MouseEvent) => {
    if (!isValidPhone) {
      e.preventDefault();
      setPhoneError('Please enter a valid phone number with country code (e.g. +1 555 123 4567)');
      return;
    }
    setPhoneError('');
    
    setWhatsAppOpen(false);
  };

  const handleInsertTodayTasks = () => {
    const activeTasks = tasks.filter((t) => t.status !== 'completed');
    const taskBrief = activeTasks
      .slice(0, 5)
      .map((t, idx) => `${idx + 1}. [${t.priority}] ${t.title}`)
      .join('\n');

    const template = `Hello, here is my Cosmos OS daily task brief:\n\n${taskBrief}\n\nSent from Cosmos OS.`;
    setMessage(template);
    showToast('Inserted today’s task brief', 'info');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={() => setWhatsAppOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="WhatsApp Dispatcher"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                WhatsApp Direct Dispatch
              </h2>
              <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                Official Click-to-Chat & Text Sharing
              </p>
            </div>
          </div>
          <button
            onClick={() => setWhatsAppOpen(false)}
            aria-label="Close WhatsApp dialog"
            className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
              Recipient Phone Number (with Country Code)
            </label>
            <div className="flex items-center rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs">
              <Phone className="h-3.5 w-3.5 text-[#8A8E85] mr-2 shrink-0" />
              <input
                type="tel"
                placeholder="+1 555 123 4567"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setPhoneError('');
                }}
                className="w-full bg-transparent text-[#252821] dark:text-[#ECEDE6] focus:outline-none font-mono"
                autoFocus
              />
            </div>
            {phoneError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                {phoneError}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                Message / Text Content
              </label>
              <button
                type="button"
                onClick={handleInsertTodayTasks}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
              >
                <FileText className="h-3 w-3" />
                <span>Insert Today's Tasks</span>
              </button>
            </div>
            <textarea
              rows={4}
              placeholder="Type message or click 'Insert Today's Tasks'..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] p-3 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none resize-none"
            />
          </div>

          <div className="rounded-lg bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 p-3 text-[11px] text-[#6B7067] dark:text-[#A6AB9F] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#252821] dark:text-[#ECEDE6]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Official Deeplink Security</span>
            </div>
            <p>
              Opens an official <code>wa.me</code> link in WhatsApp (app on phones, WhatsApp Web otherwise). Cosmos OS cannot read, sync, or send your chats; it only opens the link you build here.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href="https://web.whatsapp.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:underline"
            >
              <span>Open WhatsApp Web</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <button
              type="button"
              onClick={handleSaveFollowUp}
              className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] px-3 py-2 text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
            >
              Save as follow-up task
            </button>

            <a
              href={targetUrl}
              onClick={handleLaunchClick}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Launch WhatsApp Chat</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
