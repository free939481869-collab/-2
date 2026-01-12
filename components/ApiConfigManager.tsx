import React, { useState, useEffect } from 'react';
import { ApiConfig, ApiConfigFormData } from '../types';
import { 
  getApiConfigs, 
  addApiConfig, 
  updateApiConfig, 
  deleteApiConfig, 
  setDefaultConfig 
} from '../services/configService';
import { Button } from './Button';

interface ApiConfigManagerProps {
  onConfigSelect?: (configId: string) => void;
  selectedConfigId?: string;
}

export function ApiConfigManager({ onConfigSelect, selectedConfigId }: ApiConfigManagerProps) {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [formData, setFormData] = useState<ApiConfigFormData>({
    name: '',
    apiKey: '',
    baseUrl: '',
    models: ''
  });
  const [modelList, setModelList] = useState<string[]>([]);
  const [newModelInput, setNewModelInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ApiConfigFormData, string>>>({});

  // 预设的常见模型列表
  const presetModels = [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = () => {
    const loaded = getApiConfigs();
    setConfigs(loaded);
    
    // 如果没有选中的配置，自动选择默认配置
    if (!selectedConfigId && loaded.length > 0) {
      const defaultConfig = loaded.find(c => c.isDefault) || loaded[0];
      onConfigSelect?.(defaultConfig.id);
    }
  };

  const openAddModal = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      apiKey: '',
      baseUrl: '',
      models: ''
    });
    setModelList(['gemini-3-pro-preview', 'gemini-2.5-flash-image', 'gemini-3-flash-preview']);
    setNewModelInput('');
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (config: ApiConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || '',
      models: ''
    });
    setModelList([...config.models]);
    setNewModelInput('');
    setErrors({});
    setIsModalOpen(true);
  };

  const handleAddModel = () => {
    const trimmed = newModelInput.trim();
    if (!trimmed) return;
    
    if (modelList.includes(trimmed)) {
      alert('该模型已存在');
      return;
    }
    
    setModelList([...modelList, trimmed]);
    setNewModelInput('');
  };

  const handleRemoveModel = (index: number) => {
    setModelList(modelList.filter((_, i) => i !== index));
  };

  const handleMoveModel = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === modelList.length - 1) return;
    
    const newList = [...modelList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setModelList(newList);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ApiConfigFormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '配置名称不能为空';
    }
    
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API Key 不能为空';
    }
    
    if (modelList.length === 0) {
      newErrors.models = '至少需要一个模型名称';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    try {
      if (editingConfig) {
        updateApiConfig(editingConfig.id, {
          name: formData.name.trim(),
          apiKey: formData.apiKey.trim(),
          baseUrl: formData.baseUrl.trim() || undefined,
          models: modelList
        });
      } else {
        addApiConfig({
          name: formData.name.trim(),
          apiKey: formData.apiKey.trim(),
          baseUrl: formData.baseUrl.trim() || undefined,
          models: modelList
        });
      }
      
      loadConfigs();
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`确定要删除配置 "${name}" 吗？`)) return;
    
    try {
      deleteApiConfig(id);
      loadConfigs();
      
      // 如果删除的是当前选中的配置，切换到默认配置
      if (selectedConfigId === id) {
        const remaining = getApiConfigs();
        const defaultConfig = remaining.find(c => c.isDefault) || remaining[0];
        if (defaultConfig) {
          onConfigSelect?.(defaultConfig.id);
        }
      }
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSetDefault = (id: string) => {
    try {
      setDefaultConfig(id);
      loadConfigs();
      onConfigSelect?.(id);
    } catch (error: any) {
      alert(error.message || '设置失败');
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">API 配置</h3>
          <Button 
            variant="secondary" 
            onClick={openAddModal}
            className="text-sm px-4 py-2"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            添加配置
          </Button>
        </div>

        <div className="space-y-2">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedConfigId === config.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => onConfigSelect?.(config.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{config.name}</span>
                    {config.isDefault && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        默认
                      </span>
                    )}
                    {config.id === 'pixelperfect_default_config' && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        环境变量
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>API Key: {config.apiKey ? `${config.apiKey.substring(0, 8)}...` : '未设置'}</div>
                    {config.baseUrl && <div>Base URL: {config.baseUrl}</div>}
                    <div>模型: {config.models.join(', ')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {!config.isDefault && config.id !== 'pixelperfect_default_config' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(config.id);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                      title="设为默认"
                    >
                      设为默认
                    </button>
                  )}
                  {config.id !== 'pixelperfect_default_config' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(config);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
                        title="编辑"
                      >
                        编辑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(config.id, config.name);
                        }}
                        className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                        title="删除"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 配置编辑模态框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingConfig ? '编辑配置' : '添加配置'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  配置名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: Gemini API 配置"
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.name ? 'border-red-300' : 'border-gray-200'
                  } bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="输入你的 API Key"
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.apiKey ? 'border-red-300' : 'border-gray-200'
                  } bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all`}
                />
                {errors.apiKey && <p className="text-red-500 text-xs mt-1">{errors.apiKey}</p>}
                <p className="text-gray-500 text-xs mt-1">API Key 将安全存储在浏览器本地</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Base URL (可选)
                </label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="例如: https://api.example.com/v1"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
                <p className="text-gray-500 text-xs mt-1">用于代理或自定义 API 端点，留空则使用默认地址</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  模型列表 <span className="text-red-500">*</span>
                </label>
                
                {/* 添加新模型 */}
                <div className="space-y-2 mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newModelInput}
                      onChange={(e) => setNewModelInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddModel();
                        }
                      }}
                      placeholder="输入模型名称，例如: gemini-3-pro-preview"
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                    />
                    <Button
                      variant="secondary"
                      onClick={handleAddModel}
                      disabled={!newModelInput.trim()}
                      className="px-4"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      添加
                    </Button>
                  </div>
                  
                  {/* 预设模型快速添加 */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 self-center">快速添加:</span>
                    {presetModels.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          if (!modelList.includes(preset)) {
                            setModelList([...modelList, preset]);
                          }
                        }}
                        disabled={modelList.includes(preset)}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 模型列表 */}
                <div className="space-y-2 min-h-[100px] max-h-[300px] overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-200">
                  {modelList.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-8">
                      暂无模型，请添加模型
                    </div>
                  ) : (
                    modelList.map((model, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition-all"
                      >
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm text-gray-900 font-medium">{model}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveModel(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-indigo-50 transition-all"
                            title="上移"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveModel(index, 'down')}
                            disabled={index === modelList.length - 1}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-indigo-50 transition-all"
                            title="下移"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRemoveModel(index)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-all"
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {errors.models && <p className="text-red-500 text-xs mt-1">{errors.models}</p>}
                <p className="text-gray-500 text-xs mt-2">
                  按优先级顺序排列，系统会依次尝试使用这些模型。使用上下箭头调整顺序。
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
              >
                取消
              </Button>
              <Button onClick={handleSubmit}>
                {editingConfig ? '保存' : '添加'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
