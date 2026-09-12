import React from 'react';
import { Modal } from './Modal';
import { Keyboard, Navigation, Zap } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcuts = [
    {
      group: 'Quick Navigation',
      icon: <Navigation className="w-4 h-4 text-brand-600" />,
      items: [
        { keys: ['g', 'o'], description: 'Go to Overview dashboard' },
        { keys: ['g', 't'], description: 'Go to Transactions list' },
        { keys: ['g', 'b'], description: 'Go to Budgets & Spending' },
        { keys: ['g', 'p'], description: 'Go to Saving Pots' },
        { keys: ['g', 'r'], description: 'Go to Recurring Bills' },
      ]
    },
    {
      group: 'Actions & Filtering',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      items: [
        { keys: ['n'], description: 'Create new transaction modal' },
        { keys: ['/'], description: 'Focus search bar' },
        { keys: ['['], description: 'Previous page in transactions' },
        { keys: [']'], description: 'Next page in transactions' },
        { keys: ['?'], description: 'Toggle this keyboard shortcuts dialog' },
        { keys: ['Esc'], description: 'Close any active modal or drawer' },
      ]
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      description="Power-user keyboard navigation and shortcuts"
    >
      <div className="space-y-6">
        {shortcuts.map((section, idx) => (
          <div key={idx} className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              {section.icon}
              <span>{section.group}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl divide-y divide-slate-200/60 overflow-hidden">
              {section.items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">{item.description}</span>
                  <div className="flex items-center space-x-1">
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="px-2 py-0.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded shadow-sm"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
