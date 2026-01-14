const FIGMA_URL_HISTORY_KEY = 'pixelperfect_figma_url_history';
const MAX_HISTORY_COUNT = 10;

/**
 * 获取 Figma URL 历史记录
 */
export const getFigmaUrlHistory = (): string[] => {
  try {
    const stored = localStorage.getItem(FIGMA_URL_HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (error) {
    console.error('Failed to load Figma URL history:', error);
    return [];
  }
};

/**
 * 保存 Figma URL 到历史记录
 */
export const saveFigmaUrlToHistory = (url: string): void => {
  if (!url || !url.trim()) return;
  
  try {
    const history = getFigmaUrlHistory();
    const trimmedUrl = url.trim();
    
    // 移除重复项
    const filtered = history.filter(item => item !== trimmedUrl);
    
    // 添加到开头
    const updated = [trimmedUrl, ...filtered];
    
    // 限制数量
    const limited = updated.slice(0, MAX_HISTORY_COUNT);
    
    localStorage.setItem(FIGMA_URL_HISTORY_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('Failed to save Figma URL history:', error);
  }
};

/**
 * 清除历史记录
 */
export const clearFigmaUrlHistory = (): void => {
  try {
    localStorage.removeItem(FIGMA_URL_HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear Figma URL history:', error);
  }
};
