import { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Minus } from 'lucide-react';

interface ChecklistItem {
  item_name: string;
  status: 'ok' | 'needs_attention' | 'failed' | 'na';
  notes: string;
}

interface ServiceChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
}

const DEFAULT_CHECKLIST_ITEMS = [
  'Estado de puertas',
  'Botonera de cabina',
  'Botoneras de piso',
  'Nivelación',
  'Iluminación de cabina',
  'Sala de máquinas',
  'Sistema de freno',
  'Ruidos o vibraciones',
  'Limpieza general',
  'Seguridad general',
];

const STATUS_OPTIONS = [
  { value: 'ok', label: 'OK', icon: CheckCircle, color: 'text-success bg-success/10' },
  { value: 'needs_attention', label: 'Observado', icon: AlertTriangle, color: 'text-warning bg-warning/10' },
  { value: 'failed', label: 'Requiere intervención', icon: XCircle, color: 'text-danger bg-danger/10' },
  { value: 'na', label: 'No aplica', icon: Minus, color: 'text-gray-500 bg-gray-100' },
] as const;

export default function ServiceChecklist({ items, onChange, readOnly = false }: ServiceChecklistProps) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const handleStatusChange = (index: number, status: ChecklistItem['status']) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], status };
    onChange(newItems);
  };

  const handleNotesChange = (index: number, notes: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], notes };
    onChange(newItems);
  };

  const getStatusIcon = (status: ChecklistItem['status']) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    if (!option) return null;
    const Icon = option.icon;
    return <Icon size={18} />;
  };

  const getStatusColor = (status: ChecklistItem['status']) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option?.color || '';
  };

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-gray-700 mb-3">Checklist de Mantenimiento</h4>
      
      {items.map((item, index) => (
        <div
          key={item.item_name}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <div className="flex items-center justify-between p-3 bg-gray-50">
            <span className="font-medium text-gray-700 text-sm">{item.item_name}</span>
            <div className="flex items-center gap-2">
              {!readOnly && (
                <div className="flex gap-1">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleStatusChange(index, option.value as ChecklistItem['status'])}
                        className={`p-1.5 rounded transition-colors ${
                          item.status === option.value
                            ? option.color
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={option.label}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              )}
              {readOnly && (
                <span className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${getStatusColor(item.status)}`}>
                  {getStatusIcon(item.status)}
                  {STATUS_OPTIONS.find(o => o.value === item.status)?.label}
                </span>
              )}
              <button
                type="button"
                onClick={() => setExpandedItem(expandedItem === index ? null : index)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                {item.notes ? '📝' : '➕'}
              </button>
            </div>
          </div>
          
          {expandedItem === index && (
            <div className="p-3 border-t border-gray-100">
              <textarea
                value={item.notes}
                onChange={(e) => handleNotesChange(index, e.target.value)}
                placeholder="Observaciones opcionales..."
                className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                rows={2}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function createDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_ITEMS.map(item_name => ({
    item_name,
    status: 'ok' as const,
    notes: '',
  }));
}
