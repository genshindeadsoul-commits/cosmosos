import React, { useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { todayLocal } from '../../lib/recurrence';

export const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/';

/**
 * WhatsApp Web is opened in its own tab. WhatsApp serves it with framing disabled, so it can't be shown inside
 * another page, and Cosmos OS never reads, injects into, or stores anything from it. Cosmos OS can't tell whether
 * you're linked, so no "connected" state is shown.
 */
export const WhatsAppView: React.FC = () => {
  const { addTask } = useApp();
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const digits = phone.replace(/\D/g, '');
  const valid = digits.length >= 8 && digits.length <= 15;
  const chatUrl = valid ? `https://wa.me/${digits}${text.trim() ? `?text=${encodeURIComponent(text.trim())}` : ''}` : '#';

  const saveFollowUp = () => {
    if (!valid) { setError('Enter a phone number with country code (8 to 15 digits).'); return; }
    setError('');
    addTask({ title: `WhatsApp follow-up: +${digits}`, description: `Chat link: https://wa.me/${digits}${text.trim() ? `\nDraft: ${text.trim()}` : ''}`, list: 'Inbox', priority: 'MEDIUM', status: 'todo', dueDate: todayLocal() });
  };

  const card = 'rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-5';
  return (
    <div className="mx-auto max-w-2xl space-y-4 text-[#252821] dark:text-[#ECEDE6]">
      <section className={card}>
        <h1 className="mb-1 flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp Web</h1>
        <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">Opens in a separate tab so your Cosmos OS workspace stays exactly as it is.</p>
        <a href={WHATSAPP_WEB_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded bg-[#3D5240] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white">
          Open WhatsApp Web <ExternalLink className="h-3 w-3" />
        </a>
        <h2 className="mt-5 text-xs font-bold">First time? Link your phone</h2>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs">
          <li>Open WhatsApp on your phone.</li>
          <li>Android: tap ⋮ Menu → <strong>Linked devices</strong>. iPhone: Settings → <strong>Linked devices</strong>.</li>
          <li>Tap <strong>Link a device</strong> and scan the QR code shown on the WhatsApp Web tab.</li>
        </ol>
        <h2 className="mt-4 text-xs font-bold">If it doesn’t load</h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[#6B7067] dark:text-[#A6AB9F]">
          <li>Open <a className="underline" href={WHATSAPP_WEB_URL} target="_blank" rel="noopener noreferrer">web.whatsapp.com</a> directly: pop-up blockers can stop new tabs.</li>
          <li>WhatsApp Web needs a current desktop browser; some work or school networks block it.</li>
          <li>On a phone, use the WhatsApp app instead.</li>
        </ul>
        <p className="mt-3 text-[11px] text-[#8A8E85]">Cosmos OS can’t see your chats or whether your phone is linked. That stays between you and WhatsApp.</p>
      </section>

      <section className={card} aria-label="Click-to-chat">
        <h2 className="mb-1 text-xs font-bold">Message a number</h2>
        <p className="mb-3 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">Builds an official <code>wa.me</code> link. Nothing is sent from here.</p>
        <label className="block text-[11px] font-semibold" htmlFor="wa-phone">Phone number with country code</label>
        <input id="wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91 98765 43210" className="mt-1 w-full rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1.5 text-xs" />
        <label className="mt-2 block text-[11px] font-semibold" htmlFor="wa-text">Message (optional)</label>
        <textarea id="wa-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-1 w-full rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1.5 text-xs" />
        {error && <p role="alert" className="mt-1 text-[11px] text-rose-700 dark:text-rose-400">{error}</p>}
        <div className="mt-3 flex gap-2">
          <a href={chatUrl} target="_blank" rel="noopener noreferrer" aria-disabled={!valid} onClick={(e) => { if (!valid) { e.preventDefault(); setError('Enter a phone number with country code (8 to 15 digits).'); } }}
            className="rounded bg-[#3D5240] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white aria-disabled:opacity-50">Open chat</a>
          <button onClick={saveFollowUp} className="rounded border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold">Save as follow-up task</button>
        </div>
      </section>
    </div>
  );
};
