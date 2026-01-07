import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { Button } from './components/Button';
import { ResultCard } from './components/ResultCard';
import { ImageAnnotator } from './components/ImageAnnotator';
import { analyzeUiDifferences } from './services/geminiService';
import { AnalysisResult, AppState, UploadedImage } from './types';

export function App() {
  const [designImage, setDesignImage] = useState<UploadedImage | null>(null);
  const [implImage, setImplImage] = useState<UploadedImage | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);

  const handleAnalysis = async () => {
    if (!designImage || !implImage) {
      setErrorMsg("请上传设计稿和实现截图");
      return;
    }

    setStatus(AppState.ANALYZING);
    setErrorMsg('');
    setResult(null);
    setSelectedIssueIndex(null);

    try {
      const data = await analyzeUiDifferences(designImage.base64, implImage.base64, figmaUrl);
      setResult(data);
      setStatus(AppState.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(AppState.ERROR);
      setErrorMsg("分析过程中出现错误，请检查网络或 API Key 设置。");
    }
  };

  const reset = () => {
    setDesignImage(null);
    setImplImage(null);
    setFigmaUrl('');
    setResult(null);
    setStatus(AppState.IDLE);
    setSelectedIssueIndex(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              P
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">PixelPerfect <span className="text-indigo-600 font-light">Check</span></h1>
          </div>
          <div className="text-sm text-gray-500 hidden sm:block">AI 驱动的 UI 还原度走查工具</div>
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
          
          {/* Input Panel - Hide/Shrink when success to give more room to results */}
          <div className={`space-y-4 ${status === AppState.SUCCESS ? 'lg:col-span-4 hidden lg:block' : 'lg:col-span-1'}`}>
             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
               <label className="block text-sm font-semibold text-gray-700 mb-2">Figma 链接 (可选)</label>
               <input 
                  type="text" 
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  placeholder="https://www.figma.com/file/..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
               />
             </div>

             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <FileUpload 
                  label="1. 设计原稿 (Reference)" 
                  subLabel="Figma 导出图"
                  selectedPreview={designImage?.previewUrl}
                  onFileSelect={(file, base64) => setDesignImage({ file, previewUrl: base64, base64 })}
                />
                
                <FileUpload 
                  label="2. 实现截图 (Implementation)" 
                  subLabel="前端开发截图"
                  selectedPreview={implImage?.previewUrl}
                  onFileSelect={(file, base64) => setImplImage({ file, previewUrl: base64, base64 })}
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
                {status === AppState.SUCCESS && (
                   <Button variant="secondary" onClick={reset} className="px-8">
                     新任务
                   </Button>
                )}
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
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-bold text-gray-800 animate-pulse">AI 正在逐像素比对...</h3>
                <p className="text-gray-500 mt-2">正在检测文字、配色、间距差异</p>
              </div>
            )}

            {status === AppState.SUCCESS && result && implImage && (
              <div className="space-y-6">
                 {/* Visual Comparison Area */}
                 <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                      <span>可视化差异标记</span>
                      <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Based on Implementation</span>
                    </h3>
                    <div className="relative rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                      <ImageAnnotator 
                        imageUrl={implImage.previewUrl} 
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
                 />
              </div>
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