export enum IssueSeverity {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export enum IssueCategory {
  TEXT = '文字',
  COLOR = '配色',
  SPACING = '间距',
  IMAGE = '图片',
  SIZE = '尺寸',
  OTHER = '其他'
}

export interface Issue {
  category: IssueCategory;
  severity: IssueSeverity;
  description: string;
  suggestion: string;
  location: string;
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] on 0-1000 scale
  isIgnored?: boolean;
}

export interface AnalysisResult {
  score: number;
  summary: string;
  issues: Issue[];
}

export interface UploadedImage {
  file: File;
  previewUrl: string;
  base64: string;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  models: string[]; // 模型名称列表，按优先级排序
  isDefault?: boolean;
}

export interface ApiConfigFormData {
  name: string;
  apiKey: string;
  baseUrl: string;
  models: string; // 逗号分隔的模型名称字符串
}

export interface FigmaStyleInfo {
  colors: {
    background?: string;
    text?: string;
    border?: string;
    [key: string]: string | undefined;
  };
  spacing: {
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    gap?: number;
  };
  dimensions: {
    width?: number;
    height?: number;
    borderRadius?: number;
  };
  typography: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    lineHeight?: number;
    letterSpacing?: number;
  };
  text: {
    chinese?: string[];
    english?: string[];
  };
  elements?: Array<{
    name?: string;
    type?: string;
    colors?: Record<string, string>;
    spacing?: Record<string, number>;
    dimensions?: Record<string, number>;
    text?: string;
  }>;
}