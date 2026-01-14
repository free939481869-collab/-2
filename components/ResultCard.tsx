import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult, Issue, IssueCategory, IssueSeverity } from '../types';

interface ResultCardProps {
  result: AnalysisResult;
  activeIndex: number | null;
  onIssueSelect: (index: number) => void;
  onSeverityChange?: (index: number, newSeverity: IssueSeverity) => void;
  onToggleIgnore?: (index: number) => void;
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
              className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors ${s === severity ? 'text-lime-600 bg-lime-50' : 'text-gray-600'}`}
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

// Helper component for a single issue row to reduce duplication
interface IssueRowProps {
  issue: Issue;
  idx: number;
  isActive: boolean;
  onSelect: (idx: number) => void;
  onSeverityChange?: (idx: number, sev: IssueSeverity) => void;
  onToggleIgnore?: (idx: number) => void;
}

const IssueRow: React.FC<IssueRowProps> = ({ 
  issue, 
  idx, 
  isActive, 
  onSelect, 
  onSeverityChange, 
  onToggleIgnore 
}) => {
  const isIgnored = !!issue.isIgnored;

  return (
    <div 
      onClick={() => onSelect(idx)}
      className={`p-5 transition-all duration-300 cursor-pointer group relative border-l-4
        ${isActive 
          ? 'bg-lime-50 border-l-lime-500 shadow-inner' 
          : isIgnored 
            ? 'bg-gray-50 border-l-gray-300 opacity-75 hover:opacity-100' 
            : 'hover:bg-gray-50 border-l-transparent hover:border-l-lime-200'}
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mr-1
            ${isActive ? 'bg-lime-500 text-white' : isIgnored ? 'bg-gray-400 text-white' : 'bg-gray-200 text-gray-600'}
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
          {isIgnored && (
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 text-gray-500">
              已忽略
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isIgnored && (
             <SeveritySelector 
              severity={issue.severity} 
              onSelect={(newSev) => onSeverityChange && onSeverityChange(idx, newSev)}
            />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleIgnore && onToggleIgnore(idx);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              isIgnored 
                ? 'text-lime-600 hover:bg-lime-100' 
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
            title={isIgnored ? "恢复显示 (Show)" : "忽略此问题 (Ignore)"}
          >
            {isIgnored ? (
              // Eye Icon (Show)
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              // Eye Slash Icon (Ignore)
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <h4 className={`font-medium text-sm mb-1 ml-8 leading-relaxed ${isIgnored ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
        {issue.description}
      </h4>
      
      {issue.suggestion && !isIgnored && (
        <div className="mt-2 ml-8 text-sm text-lime-600 bg-white p-2 rounded-lg border border-lime-100 inline-block shadow-sm">
          <span className="font-semibold text-xs uppercase tracking-wider mr-1">Fix:</span> 
          {issue.suggestion}
        </div>
      )}
    </div>
  );
};

export const ResultCard: React.FC<ResultCardProps> = ({ 
  result, 
  activeIndex, 
  onIssueSelect, 
  onSeverityChange,
  onToggleIgnore,
  isExpanded = false 
}) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showIgnoredSection, setShowIgnoredSection] = useState(false);
  
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

  const visibleIssues = result.issues.filter(i => !i.isIgnored);
  const ignoredIssues = result.issues.filter(i => i.isIgnored);

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
          <h3 className="font-bold text-gray-800">问题清单 ({visibleIssues.length})</h3>
          <div className="text-xs text-gray-400">AI Analysis Result</div>
        </div>
        
        <div className={`divide-y divide-gray-100 ${isExpanded ? '' : 'max-h-[600px] overflow-y-auto'} ${visibleIssues.length === 0 && ignoredIssues.length === 0 ? 'bg-gray-50' : 'bg-white'}`}>
          {visibleIssues.length === 0 && ignoredIssues.length === 0 ? (
             <div className="p-8 text-center text-gray-500">
                <p>太棒了！没有发现明显的还原问题。</p>
             </div>
          ) : (
            // Map over ALL issues but render null for ignored ones to preserve index
            result.issues.map((issue, idx) => {
              if (issue.isIgnored) return null;
              return (
                <div key={idx} ref={el => { itemRefs.current[idx] = el; }}>
                  <IssueRow 
                    issue={issue} 
                    idx={idx} 
                    isActive={activeIndex === idx} 
                    onSelect={onIssueSelect}
                    onSeverityChange={onSeverityChange}
                    onToggleIgnore={onToggleIgnore}
                  />
                </div>
              );
            })
          )}
          
          {visibleIssues.length === 0 && ignoredIssues.length > 0 && !showIgnoredSection && (
            <div className="p-8 text-center text-gray-500 bg-gray-50">
              <p>所有问题已被忽略。</p>
            </div>
          )}
        </div>

        {/* Ignored Issues Section */}
        {ignoredIssues.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50">
            <button 
              onClick={() => setShowIgnoredSection(!showIgnoredSection)}
              className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium flex items-center gap-2">
                <svg className={`w-4 h-4 transition-transform ${showIgnoredSection ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                已忽略的问题 ({ignoredIssues.length})
              </span>
              <span className="text-xs">点击{showIgnoredSection ? '折叠' : '展开'}</span>
            </button>
            
            {showIgnoredSection && (
              <div className="divide-y divide-gray-200 border-t border-gray-200">
                {result.issues.map((issue, idx) => {
                  if (!issue.isIgnored) return null;
                  return (
                    <IssueRow 
                      key={idx}
                      issue={issue} 
                      idx={idx} 
                      isActive={activeIndex === idx} 
                      onSelect={onIssueSelect}
                      // No severity change for ignored issues usually, but can keep if desired
                      onToggleIgnore={onToggleIgnore}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};