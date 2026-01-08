import React, { useState, useEffect, useRef } from 'react';
import { Issue, IssueSeverity } from '../types';

interface ImageAnnotatorProps {
  imageUrl: string;
  designImageUrl?: string;
  issues: Issue[];
  activeIndex: number | null;
  onIssueClick?: (index: number) => void;
}

// Component to render a cropped version of an image
const CroppedImage = ({ src, box }: { src: string, box: number[] }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [styles, setStyles] = useState<React.CSSProperties>({ opacity: 0 });
  const [ymin, xmin, ymax, xmax] = box;

  // We want to display the crop in a container.
  // We'll use a container with a fixed aspect ratio matching the crop (assuming square pixels).
  // Then we position the image to show that crop.
  
  const handleLoad = () => {
    if (!imgRef.current) return;
    const { naturalWidth, naturalHeight } = imgRef.current;
    
    // Scale factors (0-1000 scale to pixels)
    const scaleX = naturalWidth / 1000;
    const scaleY = naturalHeight / 1000;
    
    const cropX = xmin * scaleX;
    const cropY = ymin * scaleY;
    const cropW = (xmax - xmin) * scaleX;
    const cropH = (ymax - ymin) * scaleY;
    
    // We want the cropped area (cropW x cropH) to fill the container (100% x 100%).
    // Image width relative to container width = naturalWidth / cropW * 100%
    const widthPct = (naturalWidth / cropW) * 100;
    const heightPct = (naturalHeight / cropH) * 100;
    
    // Position
    // left: -cropX / cropW * 100% of container width?
    // cropX / naturalWidth is the ratio.
    // We want to shift left by cropX.
    // In percentages of the rendered image size: shift = (cropX / naturalWidth) * 100%.
    // But we are setting 'left' on the image relative to container.
    // Better to use transform translate.
    // translate(-cropX/naturalWidth * 100% of image width)
    
    setStyles({
      width: `${widthPct}%`,
      height: `${heightPct}%`,
      transform: `translate(-${(cropX/naturalWidth)*100}%, -${(cropY/naturalHeight)*100}%)`,
      transformOrigin: 'top left',
      position: 'absolute',
      top: 0,
      left: 0,
      maxWidth: 'none', // Override tailwind
      opacity: 1
    });
  };

  const aspectRatio = (xmax - xmin) / (ymax - ymin);

  return (
    <div 
      className="overflow-hidden relative bg-gray-100 rounded-lg border border-gray-200 w-full"
      style={{ aspectRatio: `${aspectRatio}` }}
    >
      <img 
        ref={imgRef}
        src={src} 
        alt="Crop" 
        onLoad={handleLoad}
        style={styles}
      />
      {styles.opacity === 0 && (
         <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
           Loading...
         </div>
      )}
    </div>
  );
};

export const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ imageUrl, designImageUrl, issues, activeIndex, onIssueClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [compareIssue, setCompareIssue] = useState<Issue | null>(null);

  const getSeverityColor = (severity: IssueSeverity, isActive: boolean) => {
    if (isActive) return 'border-indigo-600 bg-indigo-500/20 text-indigo-700 ring-4 ring-indigo-200 z-50';
    switch (severity) {
      case IssueSeverity.HIGH: return 'border-red-500 bg-red-500/10 text-red-600';
      case IssueSeverity.MEDIUM: return 'border-orange-500 bg-orange-500/10 text-orange-600';
      case IssueSeverity.LOW: return 'border-blue-500 bg-blue-500/10 text-blue-600';
      default: return 'border-gray-500 bg-gray-500/10 text-gray-600';
    }
  };

  const handleCompareClick = (e: React.MouseEvent, issue: Issue) => {
    e.stopPropagation();
    setCompareIssue(issue);
  };

  return (
    <div className="relative w-full font-sans select-none">
      <img 
        src={imageUrl} 
        alt="Analyzed UI" 
        className="w-full h-auto block rounded-lg shadow-sm border border-gray-200"
      />
      
      {issues.map((issue, idx) => {
        if (!issue.boundingBox || issue.boundingBox.length !== 4) return null;
        
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
            {/* Tooltip */}
            {isHovered && !isActive && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[200px] sm:max-w-xs bg-gray-900 text-white text-xs rounded-md py-2 px-3 shadow-xl pointer-events-none z-30">
                <div className="font-bold mb-1">{issue.category}: {issue.description}</div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900"></div>
              </div>
            )}
            
            {/* Number badge */}
            <div className={`absolute -top-3 -left-3 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-sm 
              ${isActive ? 'bg-indigo-600' : colorClass.split(' ')[0].replace('border-', 'bg-')}
            `}>
              {idx + 1}
            </div>

            {/* Compare Button - Visible on hover or active */}
            {(isHovered || isActive) && designImageUrl && (
               <button
                 className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-white text-gray-700 shadow-md flex items-center justify-center hover:bg-gray-100 hover:text-indigo-600 transition-colors border border-gray-200 z-50"
                 onClick={(e) => handleCompareClick(e, issue)}
                 title="查看设计对比"
               >
                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               </button>
            )}
          </div>
        );
      })}

      {/* Comparison Modal */}
      {compareIssue && designImageUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">#{issues.indexOf(compareIssue) + 1}</span>
                 {compareIssue.category} 差异对比
               </h3>
               <button onClick={() => setCompareIssue(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div>
                   <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">设计原稿 (Standard)</h4>
                   {compareIssue.boundingBox && (
                     <CroppedImage src={designImageUrl} box={compareIssue.boundingBox} />
                   )}
                </div>
                <div>
                   <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">前端实现 (Current)</h4>
                   {compareIssue.boundingBox && (
                     <CroppedImage src={imageUrl} box={compareIssue.boundingBox} />
                   )}
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-800 font-medium mb-1">问题描述</p>
                <p className="text-gray-600 text-sm">{compareIssue.description}</p>
                
                {compareIssue.suggestion && (
                  <div className="mt-3 text-sm">
                    <span className="text-indigo-600 font-medium">建议修改: </span>
                    <span className="text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 font-mono text-xs">{compareIssue.suggestion}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
              <button 
                onClick={() => setCompareIssue(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};