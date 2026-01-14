import React, { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { FileUpload } from './components/FileUpload';
import { Button } from './components/Button';
import { ResultCard } from './components/ResultCard';
import { ImageAnnotator } from './components/ImageAnnotator';
import { ApiConfigManager } from './components/ApiConfigManager';
import { FigmaUrlInput } from './components/FigmaUrlInput';
import { analyzeUiDifferences } from './services/geminiService';
import { extractFigmaStyles, formatStyleInfo } from './services/figmaService';
import { saveFigmaUrlToHistory } from './services/historyService';
import { AnalysisResult, AppState, UploadedImage, IssueSeverity } from './types';

// Logo 组件，处理图片加载失败的情况
function LogoImage() {
  const [imgSrc, setImgSrc] = useState('https://i.ibb.co/yny1GPVs/logo-2x.png');
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const attemptRef = useRef(0);

  const handleError = () => {
    attemptRef.current += 1;
    
    if (attemptRef.current === 1) {
      // 第一次失败：尝试 jpg 格式
      setImgSrc('https://i.ibb.co/yny1GPVs/logo-2x.jpg');
    } else if (attemptRef.current === 2) {
      // 第二次失败：尝试不带扩展名
      setImgSrc('https://i.ibb.co/yny1GPVs/logo-2x');
    } else {
      // 所有尝试都失败，显示占位符
      setShowPlaceholder(true);
    }
  };

  if (showPlaceholder) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
        P
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt="PixelPerfect Logo" 
      className="w-full h-full object-cover"
      onError={handleError}
    />
  );
}

export function App() {
  const [designImage, setDesignImage] = useState<UploadedImage | null>(null);
  const [implImage, setImplImage] = useState<UploadedImage | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>();
  const [showConfigManager, setShowConfigManager] = useState(false);
  const [figmaStyleInfo, setFigmaStyleInfo] = useState<string>('');
  const [isExtractingStyles, setIsExtractingStyles] = useState(false);
  
  // Ref for the content we want to print to PDF
  const reportRef = useRef<HTMLDivElement>(null);

  const handleAnalysis = async () => {
    if (!designImage || !implImage) {
      setErrorMsg("请上传设计稿和实现截图");
      return;
    }

    setStatus(AppState.ANALYZING);
    setErrorMsg('');
    setResult(null);
    setSelectedIssueIndex(null);
    setFigmaStyleInfo('');
    setIsExtractingStyles(false);

    try {
      // 如果提供了 Figma URL，先提取样式信息（用于UI显示）
      let extractedStyleInfo: any = null;
      if (figmaUrl && figmaUrl.trim()) {
        setIsExtractingStyles(true);
        try {
          extractedStyleInfo = await extractFigmaStyles(figmaUrl, selectedConfigId);
          if (extractedStyleInfo) {
            const formatted = formatStyleInfo(extractedStyleInfo);
            setFigmaStyleInfo(formatted);
            console.log('Figma styles extracted:', extractedStyleInfo);
          } else {
            console.warn('Failed to extract Figma styles, continuing with analysis...');
          }
        } catch (styleError) {
          console.warn('Figma style extraction failed:', styleError);
          // 继续进行分析，即使样式提取失败
        } finally {
          setIsExtractingStyles(false);
        }
      }

      // 传递已提取的样式信息，避免重复提取
      const data = await analyzeUiDifferences(
        designImage.base64, 
        implImage.base64, 
        figmaUrl, 
        selectedConfigId,
        extractedStyleInfo
      );
      setResult(data);
      setStatus(AppState.SUCCESS);
      
      // 保存 Figma URL 到历史记录
      if (figmaUrl && figmaUrl.trim()) {
        saveFigmaUrlToHistory(figmaUrl);
      }
    } catch (error: any) {
      console.error(error);
      setStatus(AppState.ERROR);
      setErrorMsg(error.message || "分析过程中出现错误，请检查网络或 API Key 设置。");
      setIsExtractingStyles(false);
    }
  };

  const handleSeverityChange = useCallback((index: number, newSeverity: IssueSeverity) => {
    if (!result) return;
    
    const newIssues = [...result.issues];
    newIssues[index] = { ...newIssues[index], severity: newSeverity };
    
    setResult({
      ...result,
      issues: newIssues
    });
  }, [result]);

  const toggleIssueIgnore = useCallback((index: number) => {
    if (!result) return;
    
    const newIssues = [...result.issues];
    const newIsIgnored = !newIssues[index].isIgnored;
    newIssues[index] = { ...newIssues[index], isIgnored: newIsIgnored };
    
    setResult({
      ...result,
      issues: newIssues
    });

    // If we just ignored the currently selected issue, deselect it
    if (selectedIssueIndex === index && newIsIgnored) {
      setSelectedIssueIndex(null);
    }
  }, [result, selectedIssueIndex]);

  const reset = () => {
    setDesignImage(null);
    setImplImage(null);
    setFigmaUrl('');
    setResult(null);
    setStatus(AppState.IDLE);
    setSelectedIssueIndex(null);
  };

  const handleRemoveImplImage = () => {
    if (window.confirm('确定要删除开发截图吗？删除后将清除所有分析结果。')) {
      setImplImage(null);
      // 如果有分析结果，清除结果和状态
      if (result) {
        setResult(null);
        setStatus(AppState.IDLE);
        setSelectedIssueIndex(null);
      }
    }
  };

  const handleRemoveDesignImage = () => {
    if (window.confirm('确定要删除设计原稿吗？删除后将清除所有分析结果。')) {
      setDesignImage(null);
      // 如果有分析结果，清除结果和状态
      if (result) {
        setResult(null);
        setStatus(AppState.IDLE);
        setSelectedIssueIndex(null);
      }
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !result) return;
    
    setIsExporting(true);
    // Give React a moment to render the expanded view (remove scrollbars)
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true, // Allow loading cross-origin images (like data URIs)
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Use a custom page size based on the content height to avoid ugly page breaks
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [imgWidth, imgHeight + 40]
      });

      pdf.addImage(imgData, 'PNG', 0, 20, imgWidth, imgHeight);
      pdf.save(`PixelPerfect_Report_${new Date().toISOString().slice(0, 10)}.pdf`);

    } catch (err) {
      console.error("PDF Export failed", err);
      alert("导出失败，请重试");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-lime-500">
              <LogoImage />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">PixelPerfect <span className="text-lime-500 font-light">Check</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 hidden sm:block">AI 驱动的 UI 还原度走查工具</div>
            <Button
              variant="secondary"
              onClick={() => setShowConfigManager(!showConfigManager)}
              className="text-sm px-4 py-2"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              API 配置
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {status === AppState.IDLE && (
           <div className="mb-8 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">新建比对任务</h2>
            <p className="text-gray-500">上传 Figma 设计稿导出图与前端实现截图，AI 将自动分析视觉差异。</p>
          </div>
        )}

        {/* Configuration Section */}
        <div className={`grid grid-cols-1 ${status === AppState.SUCCESS ? 'lg:grid-cols-12' : 'lg:grid-cols-2'} gap-8 mb-10 transition-all duration-500`}>
          
          {/* Input Panel */}
          <div className={`space-y-4 ${status === AppState.SUCCESS ? 'lg:col-span-4 hidden lg:block' : 'lg:col-span-1'}`}>
             {showConfigManager && (
               <ApiConfigManager
                 onConfigSelect={setSelectedConfigId}
                 selectedConfigId={selectedConfigId}
               />
             )}
             
             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
               <label className="block text-sm font-semibold text-gray-700 mb-2">Figma 链接 (可选)</label>
               <FigmaUrlInput
                  value={figmaUrl}
                  onChange={setFigmaUrl}
                  placeholder="https://www.figma.com/file/..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-lime-500 focus:ring-2 focus:ring-lime-100 outline-none transition-all text-sm"
               />
             </div>

             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <FileUpload 
                  label="1. 设计原稿 (Reference)" 
                  subLabel="Figma 导出图"
                  selectedPreview={designImage?.previewUrl}
                  onFileSelect={(file, base64) => setDesignImage({ file, previewUrl: base64, base64 })}
                  onRemove={handleRemoveDesignImage}
                />
                
                <FileUpload 
                  label="2. 实现截图 (Implementation)" 
                  subLabel="开发截图"
                  selectedPreview={implImage?.previewUrl}
                  onFileSelect={(file, base64) => setImplImage({ file, previewUrl: base64, base64 })}
                  onRemove={handleRemoveImplImage}
                />
             </div>
             
             {errorMsg && (
               <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center gap-2">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 {errorMsg}
               </div>
             )}

             <div className="flex gap-4 pt-2">
                <Button 
                  onClick={handleAnalysis} 
                  isLoading={status === AppState.ANALYZING}
                  disabled={!designImage || !implImage}
                  className="w-full text-lg h-12"
                >
                  {status === AppState.ANALYZING ? '正在分析...' : '开始比对'}
                </Button>
             </div>
          </div>

          {/* Results Section */}
          <div className={`${status === AppState.SUCCESS ? 'lg:col-span-8' : 'lg:col-span-1'} transition-all duration-500`}>
            {status === AppState.IDLE && (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                <p className="font-medium text-lg">等待分析结果</p>
                <p className="text-sm mt-1">请在左侧上传图片并开始任务</p>
              </div>
            )}
            
            {status === AppState.ANALYZING && (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="w-16 h-16 border-4 border-lime-200 border-t-lime-500 rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-bold text-gray-800 animate-pulse">
                  {isExtractingStyles ? '正在提取 Figma 样式信息...' : 'AI 正在逐像素比对...'}
                </h3>
                <p className="text-gray-500 mt-2">
                  {isExtractingStyles 
                    ? '正在从 Figma 链接读取颜色、间距、尺寸、文本等信息'
                    : '正在检测文字、配色、间距差异'}
                </p>
                {figmaStyleInfo && (
                  <div className="mt-6 max-w-2xl w-full p-4 bg-lime-50 border border-lime-200 rounded-xl text-left">
                    <h4 className="text-sm font-semibold text-lime-900 mb-2">已提取的 Figma 样式信息：</h4>
                    <pre className="text-xs text-lime-700 whitespace-pre-wrap font-mono">{figmaStyleInfo}</pre>
                  </div>
                )}
              </div>
            )}

            {status === AppState.SUCCESS && result && implImage && (
              <>
                <div ref={reportRef} className="space-y-6 bg-gray-50 p-1"> 
                   <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm break-inside-avoid">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                        <span>可视化差异标记</span>
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Based on Implementation</span>
                      </h3>
                      <div className="relative rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                        <ImageAnnotator 
                          imageUrl={implImage.previewUrl}
                          designImageUrl={designImage?.previewUrl} 
                          issues={result.issues}
                          activeIndex={selectedIssueIndex}
                          onIssueClick={(idx) => setSelectedIssueIndex(idx)}
                        />
                      </div>
                   </div>

                   <ResultCard 
                      result={result} 
                      activeIndex={selectedIssueIndex}
                      onIssueSelect={(idx) => setSelectedIssueIndex(idx)}
                      onSeverityChange={handleSeverityChange}
                      onToggleIgnore={toggleIssueIgnore}
                      isExpanded={isExporting}
                   />
                </div>

                <div className="mt-6 flex justify-end">
                   <Button 
                     variant="secondary" 
                     onClick={handleExportPDF}
                     isLoading={isExporting}
                     className="w-full sm:w-auto"
                   >
                     <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                     {isExporting ? '正在生成 PDF...' : '导出分析报告'}
                   </Button>
                </div>
              </>
            )}
            
            {status === AppState.ERROR && (
               <div className="h-full min-h-[500px] flex flex-col items-center justify-center rounded-3xl bg-red-50 border border-red-100 p-8 text-center">
                 <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4 text-2xl">!</div>
                 <h3 className="text-lg font-bold text-gray-800">分析失败</h3>
                 <p className="text-gray-500 mt-2 text-sm">{errorMsg || "请重试"}</p>
                 <Button variant="outline" className="mt-6" onClick={() => setStatus(AppState.IDLE)}>重试</Button>
               </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}