import React, { useState, useEffect, useRef } from 'react';
import { getFigmaUrlHistory, saveFigmaUrlToHistory } from '../services/historyService';

interface FigmaUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FigmaUrlInput({ 
  value, 
  onChange, 
  placeholder = "https://www.figma.com/file/...",
  className = ""
}: FigmaUrlInputProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredHistory, setFilteredHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const historyList = getFigmaUrlHistory();
    setHistory(historyList);
    setFilteredHistory(historyList);
  }, []);

  // 当输入框获得焦点时，重新加载历史记录（可能其他组件保存了新记录）
  const handleInputFocus = () => {
    const historyList = getFigmaUrlHistory();
    setHistory(historyList);
    setFilteredHistory(historyList);
    if (historyList.length > 0) {
      setShowDropdown(true);
    }
  };

  useEffect(() => {
    // 当输入值变化时，过滤历史记录
    if (value.trim()) {
      const filtered = history.filter(item => 
        item.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredHistory(filtered);
    } else {
      setFilteredHistory(history);
    }
  }, [value, history]);

  useEffect(() => {
    // 点击外部时关闭下拉框
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowDropdown(true);
  };


  const handleSelectHistory = (url: string) => {
    onChange(url);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredHistory.length > 0 && showDropdown) {
      // 按 Enter 选择第一个匹配项
      handleSelectHistory(filteredHistory[0]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleBlur = () => {
    // 延迟关闭，以便点击选项时能触发
    setTimeout(() => {
      setShowDropdown(false);
    }, 200);
  };

  const handleClearHistory = () => {
    // 这里可以添加清除历史记录的功能
    // 暂时不实现，因为需要确认对话框
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={className}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && filteredHistory.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto"
        >
          <div className="p-2">
            <div className="text-xs text-gray-500 px-3 py-2 font-medium">历史记录</div>
            {filteredHistory.map((url, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectHistory(url)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-lime-50 hover:text-lime-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate flex-1">{url}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
