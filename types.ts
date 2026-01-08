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