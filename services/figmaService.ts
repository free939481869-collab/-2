import { GoogleGenAI } from "@google/genai";
import { FigmaStyleInfo } from "../types";
import { getActiveConfig } from "./configService";

/**
 * 解析 Figma URL，提取 file key 和 node id
 */
export const parseFigmaUrl = (url: string): { fileKey?: string; nodeId?: string } => {
  try {
    // 支持多种 Figma URL 格式
    // https://www.figma.com/file/{fileKey}/{name}?node-id={nodeId}
    // https://www.figma.com/design/{fileKey}/{name}?node-id={nodeId}
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const fileKey = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
    const nodeId = urlObj.searchParams.get('node-id')?.replace(/-/g, ':') || undefined;
    
    return { fileKey, nodeId };
  } catch (error) {
    console.error('Failed to parse Figma URL:', error);
    return {};
  }
};

/**
 * 使用 Gemini API 从 Figma 链接提取样式信息
 */
export const extractFigmaStyles = async (
  figmaUrl: string,
  configId?: string
): Promise<FigmaStyleInfo | null> => {
  if (!figmaUrl || !figmaUrl.trim()) {
    return null;
  }

  try {
    const config = getActiveConfig(configId);
    if (!config || !config.apiKey) {
      console.warn('No API config available for Figma extraction');
      return null;
    }

    const ai = new GoogleGenAI({ 
      apiKey: config.apiKey,
      baseUrl: config.baseUrl 
    } as any);

    const extractionPrompt = `
请分析这个 Figma 设计稿链接，提取详细的样式信息。

Figma 链接: ${figmaUrl}

**注意：** 如果你可以访问这个链接，请直接分析页面内容。如果无法直接访问（需要登录），请基于 Figma 链接的上下文和常见的设计规范来推断可能的样式信息。

请提取以下信息并以 JSON 格式返回：

1. **颜色信息 (colors)**:
   - background: 背景颜色（hex 格式，如 #FFFFFF）
   - text: 文本颜色
   - border: 边框颜色
   - 其他主要颜色

2. **间距信息 (spacing)**:
   - padding: { top, right, bottom, left } (单位: px)
   - margin: { top, right, bottom, left } (单位: px)
   - gap: 元素间距 (单位: px)

3. **尺寸信息 (dimensions)**:
   - width: 宽度 (单位: px)
   - height: 高度 (单位: px)
   - borderRadius: 圆角半径 (单位: px)

4. **字体信息 (typography)**:
   - fontFamily: 字体族
   - fontSize: 字体大小 (单位: px)
   - fontWeight: 字体粗细 (如: 400, 500, 600, bold)
   - lineHeight: 行高 (单位: px 或数字)
   - letterSpacing: 字间距 (单位: px)

5. **文本内容 (text)**:
   - chinese: 中文文本数组
   - english: 英文文本数组

6. **主要元素信息 (elements)** (可选):
   - 数组形式，每个元素包含 name, type, colors, spacing, dimensions, text

请以 JSON 格式返回，格式如下：
{
  "colors": {
    "background": "#FFFFFF",
    "text": "#000000"
  },
  "spacing": {
    "padding": { "top": 16, "right": 24, "bottom": 16, "left": 24 },
    "margin": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
    "gap": 8
  },
  "dimensions": {
    "width": 375,
    "height": 812,
    "borderRadius": 8
  },
  "typography": {
    "fontFamily": "Inter",
    "fontSize": 16,
    "fontWeight": 400,
    "lineHeight": 24,
    "letterSpacing": 0
  },
  "text": {
    "chinese": ["示例文本"],
    "english": ["Example Text"]
  },
  "elements": []
}

如果无法访问或提取某些信息，请返回 null 或空对象，但保持 JSON 结构完整。
`;

    // 使用第一个模型尝试提取
    const models = config.models || ['gemini-3-pro-preview', 'gemini-2.5-flash-image', 'gemini-3-flash-preview'];
    let lastError: any = null;

    for (const modelName of models) {
      try {
        console.log(`Extracting Figma styles with model: ${modelName}`);
        
        const response = await ai.models.generateContent({
          model: modelName.trim(),
          contents: {
            parts: [{ text: extractionPrompt }]
          },
          config: {
            temperature: 0.3,
            responseMimeType: "application/json"
          }
        });

        const text = response.text;
        if (!text) {
          throw new Error("No response from AI");
        }

        // 清理响应文本
        const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
        const styleInfo = JSON.parse(cleanedText) as FigmaStyleInfo;

        console.log('Figma styles extracted:', styleInfo);
        return styleInfo;

      } catch (error: any) {
        console.warn(`Figma extraction failed with model ${modelName}:`, error);
        lastError = error;
        continue;
      }
    }

    // 如果所有模型都失败，返回 null
    console.warn('All models failed for Figma extraction:', lastError);
    return null;

  } catch (error) {
    console.error('Failed to extract Figma styles:', error);
    return null;
  }
};

/**
 * 将样式信息格式化为可读的文本描述
 */
export const formatStyleInfo = (styleInfo: FigmaStyleInfo | null): string => {
  if (!styleInfo) return '';

  const parts: string[] = [];

  // 颜色信息
  if (styleInfo.colors && Object.keys(styleInfo.colors).length > 0) {
    const colorList = Object.entries(styleInfo.colors)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (colorList) {
      parts.push(`颜色: ${colorList}`);
    }
  }

  // 间距信息
  if (styleInfo.spacing) {
    const spacingParts: string[] = [];
    if (styleInfo.spacing.padding) {
      const p = styleInfo.spacing.padding;
      spacingParts.push(`padding: ${p.top || 0}px ${p.right || 0}px ${p.bottom || 0}px ${p.left || 0}px`);
    }
    if (styleInfo.spacing.margin) {
      const m = styleInfo.spacing.margin;
      spacingParts.push(`margin: ${m.top || 0}px ${m.right || 0}px ${m.bottom || 0}px ${m.left || 0}px`);
    }
    if (styleInfo.spacing.gap) {
      spacingParts.push(`gap: ${styleInfo.spacing.gap}px`);
    }
    if (spacingParts.length > 0) {
      parts.push(`间距: ${spacingParts.join(', ')}`);
    }
  }

  // 尺寸信息
  if (styleInfo.dimensions) {
    const dimParts: string[] = [];
    if (styleInfo.dimensions.width) dimParts.push(`width: ${styleInfo.dimensions.width}px`);
    if (styleInfo.dimensions.height) dimParts.push(`height: ${styleInfo.dimensions.height}px`);
    if (styleInfo.dimensions.borderRadius) dimParts.push(`borderRadius: ${styleInfo.dimensions.borderRadius}px`);
    if (dimParts.length > 0) {
      parts.push(`尺寸: ${dimParts.join(', ')}`);
    }
  }

  // 字体信息
  if (styleInfo.typography) {
    const typoParts: string[] = [];
    if (styleInfo.typography.fontFamily) typoParts.push(`fontFamily: ${styleInfo.typography.fontFamily}`);
    if (styleInfo.typography.fontSize) typoParts.push(`fontSize: ${styleInfo.typography.fontSize}px`);
    if (styleInfo.typography.fontWeight) typoParts.push(`fontWeight: ${styleInfo.typography.fontWeight}`);
    if (styleInfo.typography.lineHeight) typoParts.push(`lineHeight: ${styleInfo.typography.lineHeight}`);
    if (typoParts.length > 0) {
      parts.push(`字体: ${typoParts.join(', ')}`);
    }
  }

  // 文本信息
  if (styleInfo.text) {
    const textParts: string[] = [];
    if (styleInfo.text.chinese && styleInfo.text.chinese.length > 0) {
      textParts.push(`中文: ${styleInfo.text.chinese.join(', ')}`);
    }
    if (styleInfo.text.english && styleInfo.text.english.length > 0) {
      textParts.push(`英文: ${styleInfo.text.english.join(', ')}`);
    }
    if (textParts.length > 0) {
      parts.push(`文本: ${textParts.join('; ')}`);
    }
  }

  return parts.join('\n');
};
