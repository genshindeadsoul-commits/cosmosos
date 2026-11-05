import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Star,
  Trash2,
  ArrowLeft,
  Bold,
  Italic,
  List,
  Heading2,
  Quote,
  Code,
  Tag,
  Check,
  Calendar,
  CalendarPlus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { todayLocal } from '../../lib/recurrence';
import { AnchoredPopover } from '../../components/common/AnchoredPopover';

export const NotesView: React.FC = () => {
  const {
    notes,
    selectedNoteId,
    setSelectedNoteId,
    addNote,
    updateNote,
    deleteNote,
    toggleStarNote,
    showToast,
    addTask,
    saveStatus: syncStatus,
    focusRecord,
    setFocusRecord,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(todayLocal());
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const scheduleAnchorRef = useRef<HTMLButtonElement>(null);

  // Focus navigation from Calendar/Search
  useEffect(() => {
    if (focusRecord && focusRecord.kind === 'note') {
      setSelectedNoteId(focusRecord.id);
      setIsMobileEditorOpen(true);
      setFocusRecord(null);
    }
  }, [focusRecord, setFocusRecord, setSelectedNoteId]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || notes[0];

  const availableDates = Array.from(
    new Set(notes.map((n) => n.noteDate).filter(Boolean) as string[])
  ).sort().reverse();

  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (dateFilter === 'dated') return Boolean(n.noteDate);
    if (dateFilter !== 'all') return n.noteDate === dateFilter;
    return true;
  });

  const handleCreateNewNote = () => {
    const newId = addNote({
      title: 'Untitled Document',
      content: '# Untitled\n\nWrite your thoughts or references here...',
      excerpt: 'Write your thoughts or references here...',
      tags: ['Draft'],
    });
    setSelectedNoteId(newId);
    setIsMobileEditorOpen(true);
  };

  const handleTitleChange = (val: string) => {
    if (!selectedNote) return;
    updateNote({
      ...selectedNote,
      title: val,
      excerpt: selectedNote.content.slice(0, 120),
    });
  };

  const handleContentChange = (val: string) => {
    if (!selectedNote) return;
    updateNote({
      ...selectedNote,
      content: val,
      excerpt: val.replace(/^[#\s]+/, '').slice(0, 120),
    });
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!selectedNote) return;
    const textarea = document.getElementById('note-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = selectedNote.content;
    const selected = text.substring(start, end);

    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newContent = text.substring(0, start) + replacement + text.substring(end);

    handleContentChange(newContent);
  };

  return (
    <div className="h-[calc(100dvh-5rem)] max-w-7xl mx-auto flex flex-col rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden">
      {/* Two-Pane Layout (desktop) / Stacked view (mobile) */}
      <div className="flex h-full overflow-hidden">
        {/* Left Pane: Notes List (hidden on mobile if mobile editor is active) */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-col border-r border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/40 dark:bg-[#181A17]/40 ${
            isMobileEditorOpen ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] p-3.5">
            <button
              onClick={handleCreateNewNote}
              className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Page</span>
            </button>
            <span className="text-xs font-semibold text-[#8A8E85]">
              {notes.length} notes
            </span>
          </div>

          {/* Search bar & Date filter */}
          <div className="p-3 border-b border-[#DFE1D9] dark:border-[#383D35] space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs">
              <Search className="h-3.5 w-3.5 text-[#8A8E85]" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[#252821] dark:text-[#ECEDE6] placeholder-[#8A8E85] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <select
                aria-label="Filter notes by date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-2 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
              >
                <option value="all">All notes</option>
                <option value="dated">Dated notes only</option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    Date: {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredNotes.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8A8E85]">
                No notes found.
              </div>
            ) : (
              filteredNotes.map((n) => {
                const isSelected = n.id === selectedNote?.id;
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      setSelectedNoteId(n.id);
                      setIsMobileEditorOpen(true);
                    }}
                    className={`cursor-pointer rounded-lg p-3 transition-colors ${
                      isSelected
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] border border-[#DFE1D9]/70 dark:border-[#383D35]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-white' : 'text-[#252821] dark:text-[#ECEDE6]'
                        }`}
                      >
                        {n.title}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStarNote(n.id);
                        }}
                        aria-label="Star note"
                        className="p-1 text-amber-300 hover:scale-110 min-h-[28px] min-w-[28px] flex items-center justify-center shrink-0"
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            n.starred ? 'fill-amber-300 text-amber-300' : isSelected ? 'text-white/60' : 'text-[#C9CDC2]'
                          }`}
                        />
                      </button>
                    </div>

                    <p
                      className={`text-[11px] line-clamp-2 mt-1 leading-relaxed ${
                        isSelected ? 'text-white/80' : 'text-[#6B7067] dark:text-[#A6AB9F]'
                      }`}
                    >
                      {n.excerpt || 'No additional text'}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-1 pt-2 text-[10px]">
                      <span className={isSelected ? 'text-white/70' : 'text-[#8A8E85]'}>
                        {new Date(n.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        {n.noteDate && (
                          <span
                            className={`rounded px-1.5 py-0.5 font-medium ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            📅 {n.noteDate}
                          </span>
                        )}
                        {n.tags.length > 0 && (
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-[#E8EEE6] dark:bg-[#303B2E] text-[#526B55] dark:text-[#A8BDA1]'
                            }`}
                          >
                            {n.tags[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Note Editor */}
        <div
          className={`flex-1 flex-col bg-[#FFFFFF] dark:bg-[#20231F] ${
            isMobileEditorOpen ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedNote ? (
            <>
              {/* Editor Primary Toolbar */}
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-3 sm:px-4 py-2 gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setIsMobileEditorOpen(false)}
                    aria-label="Back to notes list"
                    className="flex items-center gap-1 min-h-[36px] px-2 py-1 rounded-lg text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] md:hidden shrink-0 border border-[#DFE1D9] dark:border-[#383D35]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Notes</span>
                  </button>

                  {/* Desktop Formatting Buttons (inline on md+) */}
                  <div className="hidden md:flex items-center gap-0.5 shrink-0 pl-1">
                    <button
                      onClick={() => insertFormatting('**', '**')}
                      title="Bold"
                      aria-label="Bold text"
                      className="rounded p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => insertFormatting('*', '*')}
                      title="Italic"
                      aria-label="Italic text"
                      className="rounded p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => insertFormatting('## ')}
                      title="Heading"
                      aria-label="Insert heading"
                      className="rounded p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                    >
                      <Heading2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => insertFormatting('- ')}
                      title="List"
                      aria-label="Insert list bullet"
                      className="rounded p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => insertFormatting('> ')}
                      title="Quote"
                      aria-label="Insert quote block"
                      className="rounded p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                    >
                      <Quote className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => insertFormatting('`', '`')}
                      title="Inline Code"
                      aria-label="Insert code"
                      className="rounded p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right controls: Save badge & Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className="hidden sm:flex items-center gap-1 text-[11px] text-[#477653] dark:text-[#91B594] font-medium pr-1">
                    <Check className="h-3 w-3" />
                    <span role="status">{syncStatus === 'saving' ? 'Saving…' : syncStatus === 'error' ? 'Not saved' : 'Saved'}</span>
                  </span>
                  <button
                    ref={scheduleAnchorRef}
                    onClick={() => setScheduleOpen((o) => !o)}
                    aria-label="Schedule this note"
                    aria-expanded={scheduleOpen}
                    title="Schedule: create a dated task linked to this note"
                    className="flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg p-1 text-[#8A8E85] hover:text-[#526B55] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] transition-colors"
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </button>
                  <AnchoredPopover
                    anchorRef={scheduleAnchorRef}
                    open={scheduleOpen}
                    onClose={() => setScheduleOpen(false)}
                    title="Schedule note"
                  >
                    <div className="w-56 space-y-2">
                      <label className="block text-[11px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                        Due date
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="mt-1 w-full rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                        />
                      </label>
                      <button
                        disabled={!scheduleDate}
                        onClick={() => {
                          addTask({
                            title: `Review: ${selectedNote.title || 'Untitled'}`.slice(0, 200),
                            list: 'Inbox',
                            priority: 'MEDIUM',
                            status: 'todo',
                            dueDate: scheduleDate,
                            linkedNoteId: selectedNote.id,
                          });
                          setScheduleOpen(false);
                          showToast('Linked task created', 'success');
                        }}
                        className="w-full rounded bg-[#3D5240] dark:bg-[#526B55] px-2 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Create linked task
                      </button>
                    </div>
                  </AnchoredPopover>

                  <button
                    onClick={() => toggleStarNote(selectedNote.id)}
                    aria-label="Star document"
                    className="flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg p-1 text-[#8A8E85] hover:text-amber-500 hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] transition-colors"
                  >
                    <Star
                      className={`h-4 w-4 ${selectedNote.starred ? 'fill-amber-400 text-amber-400' : ''}`}
                    />
                  </button>

                  {/* Accessible Delete Button with Confirmation */}
                  {confirmDeleteNoteId === selectedNote.id ? (
                    <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900 shadow-xs">
                      <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Delete?</span>
                      <button
                        onClick={() => {
                          deleteNote(selectedNote.id);
                          setConfirmDeleteNoteId(null);
                          setIsMobileEditorOpen(false);
                        }}
                        className="min-h-[32px] px-2.5 rounded bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteNoteId(null)}
                        className="min-h-[32px] px-2 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] rounded transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteNoteId(selectedNote.id)}
                      aria-label="Delete note"
                      className="flex items-center justify-center min-h-[36px] min-w-[36px] p-2 text-[#8A8E85] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Formatting Secondary Toolbar (only on mobile) */}
              <div className="md:hidden flex items-center gap-1 border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 px-3 py-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => insertFormatting('**', '**')}
                  title="Bold"
                  aria-label="Bold text"
                  className="rounded min-h-[32px] min-w-[32px] flex items-center justify-center text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('*', '*')}
                  title="Italic"
                  aria-label="Italic text"
                  className="rounded min-h-[32px] min-w-[32px] flex items-center justify-center text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('## ')}
                  title="Heading"
                  aria-label="Insert heading"
                  className="rounded min-h-[32px] min-w-[32px] flex items-center justify-center text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                >
                  <Heading2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('- ')}
                  title="List"
                  aria-label="Insert list bullet"
                  className="rounded min-h-[32px] min-w-[32px] flex items-center justify-center text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('> ')}
                  title="Quote"
                  aria-label="Insert quote block"
                  className="rounded min-h-[32px] min-w-[32px] flex items-center justify-center text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                >
                  <Quote className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('`', '`')}
                  title="Inline Code"
                  aria-label="Insert code"
                  className="rounded min-h-[32px] min-w-[32px] flex items-center justify-center text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                >
                  <Code className="h-3.5 w-3.5" />
                </button>
                <div className="ml-auto sm:hidden flex items-center gap-1 text-[11px] text-[#477653] dark:text-[#91B594] font-medium pr-1">
                  <Check className="h-3 w-3" />
                  <span role="status">{syncStatus === 'saving' ? 'Saving…' : syncStatus === 'error' ? 'Not saved' : 'Saved'}</span>
                </div>
              </div>

              {/* Title Input, Note Date & Tags */}
              <div className="p-3 sm:p-6 pb-2 space-y-2 max-w-3xl w-full">
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Note Title"
                  className="w-full text-lg sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6] bg-transparent focus:outline-none"
                />

                {/* Date Association for Calendar */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7067] dark:text-[#A6AB9F]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[11px] font-semibold">Note date:</span>
                  </div>
                  <input
                    type="date"
                    aria-label="Note date"
                    value={selectedNote.noteDate ?? ''}
                    onChange={(e) => updateNote({ ...selectedNote, noteDate: e.target.value || undefined })}
                    className="rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-0.5 text-xs text-[#252821] dark:text-[#ECEDE6]"
                  />
                  {selectedNote.noteDate && (
                    <button
                      onClick={() => updateNote({ ...selectedNote, noteDate: undefined })}
                      className="text-[11px] text-[#8A8E85] hover:text-rose-600 underline"
                    >
                      Clear date
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-[#8A8E85]">
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                  <div className="flex flex-wrap items-center gap-1">
                    {selectedNote.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-[#ECEDE7] dark:bg-[#292D27] px-2 py-0.5 text-[10px] font-medium text-[#6B7067] dark:text-[#A6AB9F]"
                      >
                        {t}
                      </span>
                    ))}
                    {isAddingTag ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newTagInput.trim()) {
                                updateNote({
                                  ...selectedNote,
                                  tags: [...selectedNote.tags, newTagInput.trim()],
                                });
                                showToast('Tag added', 'success');
                                setNewTagInput('');
                                setIsAddingTag(false);
                              }
                            } else if (e.key === 'Escape') {
                              setIsAddingTag(false);
                            }
                          }}
                          placeholder="Tag name..."
                          className="w-24 rounded border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-1.5 py-0.5 text-[10px] focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            if (newTagInput.trim()) {
                              updateNote({
                                ...selectedNote,
                                tags: [...selectedNote.tags, newTagInput.trim()],
                              });
                              showToast('Tag added', 'success');
                              setNewTagInput('');
                            }
                            setIsAddingTag(false);
                          }}
                          className="text-[10px] font-bold text-[#526B55] dark:text-[#A8BDA1]"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setIsAddingTag(false)}
                          className="text-[10px] text-[#8A8E85]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingTag(true)}
                        className="text-[10px] text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                      >
                        + Add tag
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Note Content Editor Area */}
              <div className="flex-1 p-3 sm:p-6 pt-2 overflow-y-auto max-w-3xl w-full">
                <textarea
                  id="note-editor-textarea"
                  value={selectedNote.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Type note content or Markdown..."
                  className="w-full h-full min-h-[180px] resize-none bg-transparent text-sm leading-relaxed text-[#252821] dark:text-[#ECEDE6] focus:outline-none font-sans"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-[#8A8E85]">
              Select a note or create a new page to begin writing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
