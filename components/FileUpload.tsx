import React, { useRef, useState } from 'react';

interface FileUploadProps {
  label: string;
  subLabel?: string;
  onFileSelect: (file: File, base64: string) => void;
  onRemove?: () => void;
  selectedPreview?: string;
  accept?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  subLabel,
  onFileSelect, 
  onRemove,
  selectedPreview,
  accept = "image/png, image/jpeg" 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onFileSelect(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the click on the parent container
    if (onRemove) {
      onRemove();
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div 
        className={`
          relative group cursor-pointer flex flex-col items-center justify-center w-full h-64 
          rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden
          ${isDragging 
            ? 'border-lime-500 bg-lime-50' 
            : 'border-gray-200 bg-white hover:border-lime-300 hover:bg-gray-50'}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {selectedPreview ? (
          <>
            <img 
              src={selectedPreview} 
              alt="Preview" 
              className="w-full h-full object-contain p-2"
            />
            
            {/* Overlay for change */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <p className="text-white font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">点击更换图片</p>
            </div>

            {/* Delete Button */}
            <button
              onClick={handleClear}
              className="absolute top-3 right-3 w-10 h-10 bg-white/80 hover:bg-red-500 hover:text-white text-gray-600 rounded-full shadow-lg flex items-center justify-center backdrop-blur-sm transition-all duration-200 z-10 group/btn"
              title="删除图片"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <div className="bg-lime-50 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300">
               <svg className="w-8 h-8 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
            <p className="mb-2 text-sm text-gray-600 font-medium">点击或拖拽上传</p>
            {subLabel && <p className="text-xs text-gray-400">{subLabel}</p>}
          </div>
        )}
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          accept={accept} 
          onChange={handleChange}
        />
      </div>
    </div>
  );
};