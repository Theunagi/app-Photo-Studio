// src/screens/Upload/components/GroupingView.tsx
import React, { useState, useCallback } from 'react';
import type { ImageGroup, GroupingResult } from '../../../services/api/imageGrouping';

interface GroupingViewProps {
  files: File[];
  groupingResult: GroupingResult;
  thumbnails: string[];
  creditsPerProject: number;
  creditsAvailable: number;
  onLaunchBatch: (groups: ImageGroup[]) => void;
  onBack: () => void;
}

const GroupingView: React.FC<GroupingViewProps> = ({
  files,
  groupingResult,
  thumbnails,
  creditsPerProject,
  creditsAvailable,
  onLaunchBatch,
  onBack,
}) => {
  const [groups, setGroups] = useState<ImageGroup[]>(groupingResult.groups);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(groupingResult.groups.map((_, i) => i))
  );

  const selectedGroups = groups.filter((_, i) => selectedIndices.has(i));
  const totalCost = selectedGroups.length * creditsPerProject;
  const canAfford = totalCost <= creditsAvailable;

  const toggleSelect = useCallback((idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(groups.map((_, i) => i)));
  }, [groups]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const updateGroupName = useCallback((groupIdx: number, name: string) => {
    setGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, name } : g
    ));
  }, []);

  const setPrimaryImage = useCallback((groupIdx: number, imageIndex: number) => {
    setGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, primaryIndex: imageIndex } : g
    ));
  }, []);

  const handleLaunch = useCallback(() => {
    const toProcess = groups.filter((_, i) => selectedIndices.has(i));
    onLaunchBatch(toProcess);
  }, [groups, selectedIndices, onLaunchBatch]);

  return (
    <div className="grouping-view">
      {/* Header */}
      <div className="grouping-header">
        <div className="grouping-header-left">
          <button className="btn-ghost" onClick={onBack}>Back</button>
          <h2>{groups.length} product{groups.length !== 1 ? 's' : ''} detected</h2>
        </div>
        <div className="grouping-header-right">
          <span className="grouping-cost">
            Cost: {totalCost} credits
            {!canAfford && <span className="grouping-cost-warning"> (insufficient)</span>}
          </span>
          <button className="btn-ghost" onClick={selectedIndices.size === groups.length ? deselectAll : selectAll}>
            {selectedIndices.size === groups.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            className="btn-primary-orange"
            onClick={handleLaunch}
            disabled={selectedIndices.size === 0 || !canAfford}
          >
            Generate {selectedIndices.size} Project{selectedIndices.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="grouping-list">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className={`group-card ${selectedIndices.has(gIdx) ? 'selected' : ''}`}>
            <div className="group-card-header">
              <label className="group-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIndices.has(gIdx)}
                  onChange={() => toggleSelect(gIdx)}
                />
                <span className="checkmark" />
              </label>
              <input
                type="text"
                className="group-name-input"
                value={group.name}
                onChange={e => updateGroupName(gIdx, e.target.value)}
                maxLength={80}
              />
              <span className="group-image-count">{group.imageIndices.length} image{group.imageIndices.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="group-images">
              {group.imageIndices.map(imgIdx => (
                <div
                  key={imgIdx}
                  className={`group-image ${imgIdx === group.primaryIndex ? 'primary' : ''}`}
                  onClick={() => setPrimaryImage(gIdx, imgIdx)}
                  title={imgIdx === group.primaryIndex ? 'Primary image' : 'Click to set as primary'}
                >
                  <img src={thumbnails[imgIdx]} alt={files[imgIdx]?.name} />
                  {imgIdx === group.primaryIndex && (
                    <span className="primary-badge">Primary</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {groupingResult.ungroupedIndices.length > 0 && (
          <div className="group-card ungrouped">
            <div className="group-card-header">
              <span className="group-name-static">Ungrouped ({groupingResult.ungroupedIndices.length})</span>
            </div>
            <div className="group-images">
              {groupingResult.ungroupedIndices.map(imgIdx => (
                <div key={imgIdx} className="group-image">
                  <img src={thumbnails[imgIdx]} alt={files[imgIdx]?.name} />
                  <span className="ungrouped-name">{files[imgIdx]?.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupingView;
