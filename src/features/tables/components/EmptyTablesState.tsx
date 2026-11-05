import React from 'react';
import {
  Table2,
  Plus,
  Sparkles,
  CheckCircle2,
  BookOpen,
  Boxes,
  ArrowRight,
} from 'lucide-react';
import type { NewTable } from '../../../types';

interface EmptyTablesStateProps {
  onCreateCustomTable: () => void;
  onCreateFromTemplate: (template: NewTable) => void;
}

export const EmptyTablesState: React.FC<EmptyTablesStateProps> = ({
  onCreateCustomTable,
  onCreateFromTemplate,
}) => {
  const templates: {
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    data: NewTable;
  }[] = [
    {
      title: 'Project Tracker',
      description: 'Track milestones, tasks, priority levels, and completion statuses.',
      icon: CheckCircle2,
      data: {
        name: 'Project Tracker',
        description: 'Track deliverables, milestones, priorities, and workflow stages.',
        columns: [
          { id: 'task', name: 'Task Name', type: 'text' },
          { id: 'status', name: 'Status', type: 'select', options: ['Backlog', 'In Progress', 'Review', 'Done'] },
          { id: 'priority', name: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Urgent'] },
          { id: 'due_date', name: 'Due Date', type: 'date' },
        ],
        rows: [
          { task: 'System Architecture Audit', status: 'Done', priority: 'High', due_date: '2026-11-05' },
          { task: 'Implement Tables Workspace', status: 'In Progress', priority: 'Urgent', due_date: '2026-11-06' },
          { task: 'User Feedback Verification', status: 'Backlog', priority: 'Medium', due_date: '2026-11-10' },
        ],
        metadata: { view: 'table' },
      },
    },
    {
      title: 'Reading & Media List',
      description: 'Catalog books, articles, podcasts, and personal notes.',
      icon: BookOpen,
      data: {
        name: 'Reading List',
        description: 'Books, research papers, videos, and media backlog.',
        columns: [
          { id: 'title', name: 'Title', type: 'text' },
          { id: 'author', name: 'Author / Creator', type: 'text' },
          { id: 'type', name: 'Media Type', type: 'select', options: ['Book', 'Article', 'Video', 'Paper'] },
          { id: 'status', name: 'Status', type: 'select', options: ['To Read', 'Reading', 'Completed'] },
          { id: 'rating', name: 'Rating (1-5)', type: 'number' },
          { id: 'url', name: 'Link / Resource', type: 'url' },
        ],
        rows: [
          { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', type: 'Book', status: 'Reading', rating: 5, url: 'https://dataintensive.net' },
          { title: 'PostgreSQL Internals', author: 'Egor Rogov', type: 'Book', status: 'To Read', rating: 5, url: '' },
        ],
        metadata: { view: 'list' },
      },
    },
    {
      title: 'Inventory & Assets',
      description: 'Track equipment, devices, quantities, and cost values.',
      icon: Boxes,
      data: {
        name: 'Office & Hardware Inventory',
        description: 'Equipment, devices, supplies, and asset valuations.',
        columns: [
          { id: 'item', name: 'Item Name', type: 'text' },
          { id: 'category', name: 'Category', type: 'select', options: ['Hardware', 'Audio', 'Office', 'Peripherals'] },
          { id: 'quantity', name: 'Quantity', type: 'number' },
          { id: 'unit_price', name: 'Unit Price', type: 'currency', currencySymbol: '₹' },
          { id: 'status', name: 'Availability', type: 'select', options: ['In Stock', 'In Use', 'Ordered'] },
        ],
        rows: [
          { item: 'Dell Ultrasharp 27" 4K Monitor', category: 'Hardware', quantity: 2, unit_price: 38000, status: 'In Use' },
          { item: 'Ergonomic Mechanical Keyboard', category: 'Peripherals', quantity: 1, unit_price: 9500, status: 'In Use' },
        ],
        metadata: { view: 'table' },
      },
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex p-3 rounded-2xl bg-[#526B55]/10 dark:bg-[#526B55]/20 text-[#526B55] dark:text-[#A8BDA1] ring-1 ring-[#526B55]/30">
          <Table2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
          Your Personal Database Workspace
        </h2>
        <p className="text-xs sm:text-sm text-[#6B7067] dark:text-[#A6AB9F] max-w-xl mx-auto leading-relaxed">
          Create flexible, structured spreadsheets to track anything from personal projects, inventory, reading lists, or habit logs. View as tables, lists, or Kanban boards.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={onCreateCustomTable}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-[#526B55] hover:bg-[#435946] shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Custom Table</span>
          </button>
        </div>
      </div>

      {/* Starter Templates */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#6B7067] dark:text-[#A6AB9F] uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
          <span>Or get started with a starter template</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div
                key={tpl.title}
                onClick={() => onCreateFromTemplate(tpl.data)}
                className="group p-4 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] hover:border-[#526B55] hover:shadow-md cursor-pointer transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="p-2 rounded-lg bg-[#F5F5F0] dark:bg-[#181A17] text-[#526B55] dark:text-[#A8BDA1] w-fit group-hover:bg-[#526B55] group-hover:text-white transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {tpl.title}
                  </h3>
                  <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] group-hover:translate-x-1 transition-transform">
                  <span>Use Template</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
