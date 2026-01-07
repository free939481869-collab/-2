import React, { useEffect, useRef } from 'react';
import { AnalysisResult, Issue, IssueCategory, IssueSeverity } from '../types';

interface ResultCardProps {
  result: AnalysisResult;
  activeIndex: number | null;
  onIssueSelect: (index: number) => void;
  isExpanded?: boolean; // New prop to expand list for PDF export
}

const SeverityBadge = ({ severity }: { severity: IssueSeverity }) => {
  const colors = {
    [IssueSeverity.HIGH]: "bg-red-100 text-red-700 border-red-200",
    [IssueSeverity.MEDIUM]: "bg-orange-100 text-orange-700 border-orange-200",
    [IssueSeverity.LOW]: "bg-blue-100 text-blue-700 border-blue-200"
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${colors[severity]}`}>
      {severity}
    </span>
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

export const ResultCard: React.FC<ResultCardProps> = ({ result, activeIndex, onIssueSelect, isExpanded = false }) => {
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
        
        {/* Conditional styling: Remove max-height and overflow if isExpanded is true */}
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
                  <SeverityBadge severity={issue.severity} />
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