import React, { useState } from 'react';
import { Issue, IssueSeverity } from '../types';

interface ImageAnnotatorProps {
  imageUrl: string;
  issues: Issue[];
  activeIndex: number | null;
  onIssueClick?: (index: number) => void;
}

export const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ imageUrl, issues, activeIndex, onIssueClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getSeverityColor = (severity: IssueSeverity, isActive: boolean) => {
    // If active, use a strong color
    if (isActive) return 'border-indigo-600 bg-indigo-500/20 text-indigo-700 ring-4 ring-indigo-200 z-50';

    switch (severity) {
      case IssueSeverity.HIGH: return 'border-red-500 bg-red-500/10 text-red-600';
      case IssueSeverity.MEDIUM: return 'border-orange-500 bg-orange-500/10 text-orange-600';
      case IssueSeverity.LOW: return 'border-blue-500 bg-blue-500/10 text-blue-600';
      default: return 'border-gray-500 bg-gray-500/10 text-gray-600';
    }
  };

  return (
    // Removed h-full to ensure the div collapses to fit the image exactly. 
    // This prevents coordinate offsets if the parent container is taller than the image.
    <div className="relative w-full font-sans select-none">
      <img 
        src={imageUrl} 
        alt="Analyzed UI" 
        className="w-full h-auto block rounded-lg shadow-sm border border-gray-200"
      />
      
      {issues.map((issue, idx) => {
        if (!issue.boundingBox || issue.boundingBox.length !== 4) return null;
        
        // Gemini returns [ymin, xmin, ymax, xmax] on a 0-1000 scale
        const [ymin, xmin, ymax, xmax] = issue.boundingBox;
        
        const style = {
          top: `${ymin / 10}%`,
          left: `${xmin / 10}%`,
          height: `${(ymax - ymin) / 10}%`,
          width: `${(xmax - xmin) / 10}%`,
        };

        const isActive = activeIndex === idx;
        const isHovered = hoveredIndex === idx;
        const colorClass = getSeverityColor(issue.severity, isActive);

        return (
          <div
            key={idx}
            className={`absolute border-2 transition-all duration-200 cursor-pointer 
              ${colorClass} 
              ${(isHovered || isActive) ? 'opacity-100' : 'opacity-70 hover:opacity-100'}
              ${isActive ? 'z-50' : 'z-10'}
            `}
            style={style}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={(e) => {
              e.stopPropagation();
              onIssueClick && onIssueClick(idx);
            }}
          >
            {/* Tooltip on hover - only show if not active (or can show both, but cleaner if hidden when active maybe) */}
            {isHovered && !isActive && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[200px] sm:max-w-xs bg-gray-900 text-white text-xs rounded-md py-2 px-3 shadow-xl pointer-events-none z-30">
                <div className="font-bold mb-1">{issue.category}: {issue.description}</div>
                {/* Triangle arrow */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900"></div>
              </div>
            )}
            
            {/* Number badge */}
            <div className={`absolute -top-3 -left-3 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-sm 
              ${isActive ? 'bg-indigo-600' : colorClass.split(' ')[0].replace('border-', 'bg-')}
            `}>
              {idx + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
};