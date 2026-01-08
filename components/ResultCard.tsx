import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult, Issue, IssueCategory, IssueSeverity } from '../types';

interface ResultCardProps {
  result: AnalysisResult;
  activeIndex: number | null;
  onIssueSelect: (index: number) => void;
  onSeverityChange?: (index: number, newSeverity: IssueSeverity) => void;
  isExpanded?: boolean;
}

const SeveritySelector = ({ 
  severity, 
  onSelect 
}: { 
  severity: IssueSeverity, 
  onSelect: (s: IssueSeverity) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const colors = {
    [IssueSeverity.HIGH]: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200",
    [IssueSeverity.MEDIUM]: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200",
    [IssueSeverity.LOW]: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${colors[severity]}`}
      >
        {severity}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-24 bg-white border border-gray-200 rounded-lg shadow-xl z-[60] overflow-hidden animate-fade-in py-1">
          {Object.values(IssueSeverity).map((s) => (
            <button
              key={s}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors ${s === severity ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600'}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s);
                setIsOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CategoryIcon = ({ category }: { category: IssueCategory }) => {
  const icons = {
    [IssueCategory.TEXT]: "T",
    [IssueCategory.COLOR]: "🎨",
    [IssueCategory.SPACING]: "↔",
    [IssueCategory.IMAGE]: "🖼️",
    [IssueCategory.SIZE]: "📐",
    [IssueCategory.OTHER]: "🔧"
  };
  return <span className="text-sm mr-2 opacity-80" role="img" aria-label={category}>{icons[category]}</span>;
};

export const ResultCard: React.FC<ResultCardProps> = ({ 
  result, 
  activeIndex, 
  onIssueSelect, 
  onSeverityChange,
  isExpanded = false 
}) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-orange-500';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200';
    if (score >= 70) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  useEffect(() => {
    if (activeIndex !== null && itemRefs.current[activeIndex] && !isExpanded) {
      itemRefs.current[activeIndex]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [activeIndex, isExpanded]);

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Score Header */}
      <div className={`p-6 rounded-2xl border ${getScoreBg(result.score)} flex items-center justify-between`}>
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">UI 还原度评分</h3>
          <p className="text-gray-600 text-sm max-w-xl">{result.summary}</p>
        </div>
        <div className={`text-5xl font-black ${getScoreColor(result.score)} tracking-tight`}>
          {result.score}
        </div>
      </div>

      {/* Issues Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">问题清单 ({result.issues.length})</h3>
          <div className="text-xs text-gray-400">AI Analysis Result</div>
        </div>
        
        <div className={`divide-y divide-gray-100 ${isExpanded ? '' : 'max-h-[600px] overflow-y-auto'}`}>
          {result.issues.length === 0 ? (
             <div className="p-8 text-center text-gray-500">
                <p>太棒了！没有发现明显的还原问题。</p>
             </div>
          ) : (
            result.issues.map((issue, idx) => (
              <div 
                key={idx} 
                ref={el => { itemRefs.current[idx] = el; }}
                onClick={() => onIssueSelect(idx)}
                className={`p-5 transition-all duration-300 cursor-pointer group relative border-l-4
                  ${activeIndex === idx 
                    ? 'bg-indigo-50 border-l-indigo-500 shadow-inner' 
                    : 'hover:bg-gray-50 border-l-transparent hover:border-l-indigo-200'}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mr-1
                      ${activeIndex === idx ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}
                    `}>
                      {idx + 1}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-white border border-gray-200 text-gray-800 shadow-sm">
                      <CategoryIcon category={issue.category} />
                      {issue.category}
                    </span>
                    <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 rounded">
                      @{issue.location}
                    </span>
                  </div>
                  <SeveritySelector 
                    severity={issue.severity} 
                    onSelect={(newSev) => onSeverityChange && onSeverityChange(idx, newSev)}
                  />
                </div>
                
                <h4 className="text-gray-800 font-medium text-sm mb-1 ml-8 leading-relaxed">{issue.description}</h4>
                
                {issue.suggestion && (
                  <div className="mt-2 ml-8 text-sm text-indigo-600 bg-white p-2 rounded-lg border border-indigo-100 inline-block shadow-sm">
                    <span className="font-semibold text-xs uppercase tracking-wider mr-1">Fix:</span> 
                    {issue.suggestion}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};