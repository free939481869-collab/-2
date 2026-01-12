import { ApiConfig } from '../types';

const STORAGE_KEY = 'pixelperfect_api_configs';
const DEFAULT_CONFIG_ID = 'pixelperfect_default_config';

/**
 * 获取默认配置（环境变量配置）
 */
const getDefaultConfig = (): ApiConfig => {
  return {
    id: DEFAULT_CONFIG_ID,
    name: '默认配置（环境变量）',
    apiKey: process.env.API_KEY || '',
    baseUrl: process.env.API_BASE_URL,
    models: ['gemini-3-pro-preview', 'gemini-2.5-flash-image', 'gemini-3-flash-preview'],
    isDefault: true
  };
};

/**
 * 获取所有保存的API配置
 */
export const getApiConfigs = (): ApiConfig[] => {
  try {
    const defaultConfig = getDefaultConfig();
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (!stored) {
      // 如果没有保存的配置，返回默认配置（使用环境变量）
      return [defaultConfig];
    }
    
    // 合并默认配置和保存的配置
    const savedConfigs = JSON.parse(stored) as ApiConfig[];
    
    // 检查是否有配置被设为默认，如果没有，将默认配置设为默认
    const hasDefault = savedConfigs.some(c => c.isDefault);
    if (!hasDefault) {
      defaultConfig.isDefault = true;
    }
    
    return [defaultConfig, ...savedConfigs];
  } catch (error) {
    console.error('Failed to load API configs:', error);
    return [getDefaultConfig()];
  }
};

/**
 * 保存API配置列表
 */
export const saveApiConfigs = (configs: ApiConfig[]): void => {
  try {
    // 过滤掉默认配置（环境变量配置不应该保存）
    const configsToSave = configs.filter(c => c.id !== DEFAULT_CONFIG_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configsToSave));
  } catch (error) {
    console.error('Failed to save API configs:', error);
    throw new Error('保存配置失败');
  }
};

/**
 * 添加新的API配置
 */
export const addApiConfig = (config: Omit<ApiConfig, 'id'>): ApiConfig => {
  const configs = getApiConfigs();
  const newConfig: ApiConfig = {
    ...config,
    id: `config_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  };
  
  // 如果这是第一个自定义配置，设为默认
  const customConfigs = configs.filter(c => c.id !== DEFAULT_CONFIG_ID);
  if (customConfigs.length === 0) {
    newConfig.isDefault = true;
  }
  
  const updatedConfigs = [...configs.filter(c => c.id !== DEFAULT_CONFIG_ID), newConfig];
  saveApiConfigs(updatedConfigs);
  return newConfig;
};

/**
 * 更新API配置
 */
export const updateApiConfig = (id: string, updates: Partial<ApiConfig>): ApiConfig | null => {
  const configs = getApiConfigs();
  const index = configs.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  const updated = { ...configs[index], ...updates };
  const updatedConfigs = [...configs];
  updatedConfigs[index] = updated;
  
  saveApiConfigs(updatedConfigs.filter(c => c.id !== DEFAULT_CONFIG_ID));
  return updated;
};

/**
 * 删除API配置
 */
export const deleteApiConfig = (id: string): boolean => {
  if (id === DEFAULT_CONFIG_ID) {
    throw new Error('不能删除默认配置');
  }
  
  const configs = getApiConfigs();
  const filtered = configs.filter(c => c.id !== id);
  
  // 如果删除的是默认配置，将第一个自定义配置设为默认
  const deletedConfig = configs.find(c => c.id === id);
  if (deletedConfig?.isDefault && filtered.length > 0) {
    const firstCustom = filtered.find(c => c.id !== DEFAULT_CONFIG_ID);
    if (firstCustom) {
      firstCustom.isDefault = true;
    }
  }
  
  saveApiConfigs(filtered.filter(c => c.id !== DEFAULT_CONFIG_ID));
  return true;
};

/**
 * 设置默认配置
 */
export const setDefaultConfig = (id: string): void => {
  const configs = getApiConfigs();
  const updatedConfigs = configs.map(c => ({
    ...c,
    isDefault: c.id === id
  }));
  
  saveApiConfigs(updatedConfigs.filter(c => c.id !== DEFAULT_CONFIG_ID));
};

/**
 * 获取当前使用的配置（默认配置或指定的配置）
 */
export const getActiveConfig = (configId?: string): ApiConfig | null => {
  const configs = getApiConfigs();
  
  if (configId) {
    const found = configs.find(c => c.id === configId);
    if (found) return found;
  }
  
  // 返回默认配置
  const defaultConfig = configs.find(c => c.isDefault);
  if (defaultConfig) return defaultConfig;
  
  // 如果都没有，返回第一个配置
  return configs[0] || null;
};
