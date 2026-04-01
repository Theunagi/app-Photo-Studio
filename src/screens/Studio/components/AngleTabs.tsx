import { Plus, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { type CameraAngle, CAMERA_ANGLES } from '../../../models/pipeline';

interface AngleTab {
  angle: CameraAngle;
  hasImage: boolean;
  thumbnailUrl: string | null;
}

interface AngleTabsProps {
  tabs: AngleTab[];
  activeIndex: number;
  onTabClick: (index: number) => void;
  onAddAngle: (angle: CameraAngle) => void;
  onRemoveAngle: (index: number) => void;
  disabled?: boolean;
}

export function AngleTabs({ tabs, activeIndex, onTabClick, onAddAngle, onRemoveAngle, disabled }: AngleTabsProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowAddMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddMenu]);

  const usedAngles = new Set(tabs.map(t => t.angle));
  const availableAngles = CAMERA_ANGLES.filter(a => !usedAngles.has(a.key));

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
      {tabs.map((tab, i) => {
        const angleDef = CAMERA_ANGLES.find(a => a.key === tab.angle);
        const isActive = i === activeIndex;
        return (
          <button
            key={tab.angle}
            onClick={() => onTabClick(i)}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px',
              background: isActive ? '#2D2D2D' : '#F5F4F0',
              border: `1px solid ${tab.hasImage ? '#ff4000' : isActive ? '#2D2D2D' : '#E8E8E4'}`,
              color: isActive ? '#FFFFFF' : '#6B6B6B',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {tab.thumbnailUrl && (
              <img src={tab.thumbnailUrl} alt={angleDef?.label} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />
            )}
            <span>{angleDef?.label ?? tab.angle}</span>
            {tabs.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); if (!disabled) onRemoveAngle(i); }}
                style={{ opacity: 0.4, cursor: 'pointer', display: 'flex', marginLeft: 2 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
              >
                <X size={12} />
              </span>
            )}
          </button>
        );
      })}

      {availableAngles.length > 0 && (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              background: '#F5F4F0', border: '1px dashed #E8E8E4',
              color: '#9E9E9E', cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Plus size={14} />
          </button>

          {showAddMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: '#FFFFFF', border: '1px solid #E8E8E4',
              borderRadius: 8, padding: 4, zIndex: 10, minWidth: 120,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}>
              {availableAngles.map(a => (
                <button
                  key={a.key}
                  onClick={() => { onAddAngle(a.key); setShowAddMenu(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', borderRadius: 4,
                    background: 'none', border: 'none', color: '#6B6B6B',
                    cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F4F0'; e.currentTarget.style.color = '#1D1D1F'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6B6B6B'; }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
