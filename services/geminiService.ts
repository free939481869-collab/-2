import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, IssueCategory, IssueSeverity, ApiConfig, FigmaStyleInfo } from "../types";
import { getActiveConfig } from "./configService";
import { extractFigmaStyles, formatStyleInfo } from "./figmaService";

// Helper to resize and compress images to avoid payload too large errors (500)
// and speed up upload. Target max width 1024px, JPEG quality 0.8.
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    // If it's already a raw base64 string without header, just return it (though usually it has header from FileReader)
    const src = base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`;
    
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str.replace(/^data:image\/\w+;base64,/, ""));
        return;
      }
      
      // Draw white background for transparent images (since we convert to JPEG)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl.replace(/^data:image\/\w+;base64,/, ""));
    };
    img.onerror = () => {
      // Fallback to original if loading fails
      resolve(base64Str.replace(/^data:image\/\w+;base64,/, ""));
    };
  });
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description: "Overall implementation score from 0 to 100"
    },
    summary: {
      type: Type.STRING,
      description: "Brief summary of the visual audit in Chinese"
    },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: [
              IssueCategory.TEXT,
              IssueCategory.COLOR,
              IssueCategory.SPACING,
              IssueCategory.IMAGE,
              IssueCategory.SIZE,
              IssueCategory.OTHER
            ]
          },
          severity: {
            type: Type.STRING,
            enum: [IssueSeverity.HIGH, IssueSeverity.MEDIUM, IssueSeverity.LOW]
          },
          description: {
            type: Type.STRING,
            description: "Detailed description of the issue"
          },
          suggestion: {
            type: Type.STRING,
            description: "How to fix it (css values if possible)"
          },
          location: {
            type: Type.STRING,
            description: "Approximate location text description"
          },
          boundingBox: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Bounding box [ymin, xmin, ymax, xmax] on 0-1000 scale representing the area of the issue on the implementation image."
          }
        },
        required: ["category", "severity", "description", "suggestion", "location", "boundingBox"]
      }
    }
  },
  required: ["score", "summary", "issues"]
};

const SYSTEM_INSTRUCTION = `
You are a pixel-perfect UI/UX Design Audit Expert. 
Your goal is to compare a 'Design Reference' (Target) image with an 'Implementation Screenshot' (Current) image.
Identify discrepancies in visual implementation with high precision.
Focus on:
1. Typography (Font weight, size, line-height, font-family).
2. Colors (Backgrounds, text colors, borders, gradients).
3. Spacing (Margins, paddings, alignment gaps).
4. Layout & Size (Element dimensions, positioning, responsiveness).
5. Content & Iconography (Missing icons, wrong images, typos).

Be strict but fair. A score of 100 means pixel-perfect matching.
For every issue identified, you MUST provide a precise bounding box on the 'Implementation' image.

**Bounding Box Format:**
The bounding box array \`[ymin, xmin, ymax, xmax]\` must use a scale of **0 to 1000** relative to the image dimensions.
- ymin: Top edge (0-1000)
- xmin: Left edge (0-1000)
- ymax: Bottom edge (0-1000)
- xmax: Right edge (0-1000)

**Important:** Ensure the bounding box tightly encloses the specific visual element or area where the discrepancy occurs. For spacing issues, highlight the gap itself.
Provide the output in valid JSON format matching the schema.
Language: Simplified Chinese (zh-CN).
`;

const ERROR_MAPPINGS: Record<string, string> = {
  "412": "所在地区暂不支持 Gemini API，请尝试使用代理或更换 IP (412 Precondition Failed)。",
  "403": "API Key 无效或无权限，请检查配置 (403 Forbidden)。",
  "500": "服务器处理失败，图片可能过大或内容过于复杂，已尝试压缩重试 (500 Internal Error)。",
  "503": "服务暂时不可用，请稍后重试 (503 Service Unavailable)。",
  "Failed to fetch": "网络请求失败，请检查网络连接或代理设置。",
  "Overloaded": "模型负载过高，请稍后重试。"
};

const getFriendlyErrorMessage = (error: any): string => {
  const msg = error?.message || String(error);
  for (const [key, friendlyMsg] of Object.entries(ERROR_MAPPINGS)) {
    if (msg.includes(key)) {
      return friendlyMsg;
    }
  }
  return `分析服务异常: ${msg.slice(0, 100)}...`;
};

export const analyzeUiDifferences = async (
  designImageBase64: string,
  implImageBase64: string,
  figmaUrl?: string,
  configId?: string,
  figmaStyleInfo?: FigmaStyleInfo | null
): Promise<AnalysisResult> => {
  // 获取配置（优先使用传入的 configId，否则使用默认配置）
  const config = getActiveConfig(configId);
  if (!config) {
    throw new Error("未找到可用的 API 配置，请先添加配置");
  }

  if (!config.apiKey) {
    throw new Error("API Key 未设置，请检查配置");
  }

  // Support for custom Base URL (e.g. proxy)
  // Use 'any' cast because the type definition might not explicitly include baseUrl in all versions, 
  // but it is supported by the underlying client.
  const ai = new GoogleGenAI({ 
    apiKey: config.apiKey,
    baseUrl: config.baseUrl 
  } as any);

  // 1. Compress images before sending to reduce payload and avoid timeouts
  // 2. Extract Figma styles if URL is provided and not already extracted
  const [designData, implData] = await Promise.all([
    compressImage(designImageBase64),
    compressImage(implImageBase64)
  ]);

  // Only extract Figma styles if not already provided
  let extractedStyleInfo = figmaStyleInfo;
  if (!extractedStyleInfo && figmaUrl) {
    extractedStyleInfo = await extractFigmaStyles(figmaUrl, configId);
  }

  // 构建包含 Figma 样式信息的提示
  let styleContext = '';
  if (extractedStyleInfo) {
    const formattedStyles = formatStyleInfo(extractedStyleInfo);
    if (formattedStyles) {
      styleContext = `
      
**Figma 设计稿样式信息：**
${formattedStyles}

请参考以上样式信息进行对比分析，确保实现与设计稿的样式完全一致。
`;
    }
  }

  const basePrompt = `
  请对比这两张图片。
  第一张图是：Figma 设计原稿 (Standard)。
  第二张图是：前端开发实现 (Implementation)。
  ${figmaUrl ? `Figma 链接: ${figmaUrl}` : ''}${styleContext}
  
  请详细分析还原度问题。请务必严格检查：
  1. **颜色**：背景色、文字颜色、边框颜色是否与设计稿一致
  2. **间距**：padding、margin、gap 是否准确
  3. **尺寸**：宽度、高度、圆角等尺寸是否匹配
  4. **字体**：字体族、字号、字重、行高、字间距是否一致
  5. **文本内容**：中英文文本是否完全一致
  
  对于每个问题，请准确标注在第二张图（实现图）上的位置坐标 (boundingBox)，使用 [ymin, xmin, ymax, xmax] (0-1000 scale) 格式。
  `;

  const runAnalysis = async (modelName: string, useSchema: boolean) => {
    console.log(`Analyzing with model: ${modelName}, useSchema: ${useSchema}`);

    const finalPrompt = useSchema 
      ? basePrompt 
      : basePrompt + "\n请直接输出 JSON 格式结果。不要使用 Markdown 代码块。JSON 结构需包含 score (number), summary (string), issues (array of objects with category, severity, description, suggestion, location, boundingBox).";

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
      // Increase temperature slightly for creativity in finding issues, but keep it low for consistency
      temperature: 0.4, 
    };

    if (useSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = RESPONSE_SCHEMA;
    }

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { text: finalPrompt },
            { inlineData: { mimeType: "image/jpeg", data: designData } },
            { inlineData: { mimeType: "image/jpeg", data: implData } }
          ]
        },
        config
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleanedText) as AnalysisResult;

    } catch (e: any) {
      console.warn(`Analysis failed with model ${modelName}:`, e);
      throw e;
    }
  };

  // 使用配置中的模型列表，按顺序尝试
  const models = config.models || ['gemini-3-pro-preview', 'gemini-2.5-flash-image', 'gemini-3-flash-preview'];
  
  // 过滤出有效的模型名称（非空且非空白字符）
  const validModels = models.map(m => m.trim()).filter(m => m.length > 0);
  
  // 如果没有有效的模型，抛出明确的错误
  if (validModels.length === 0) {
    throw new Error("配置中没有有效的模型名称，请检查 API 配置中的模型列表");
  }
  
  // 判断模型是否支持 schema（基于经验值，某些模型不支持）
  const supportsSchema = (modelName: string): boolean => {
    // 这些模型已知支持 schema
    const schemaSupportedModels = [
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ];
    return schemaSupportedModels.some(m => modelName.includes(m));
  };

  let lastError: any = null;
  
  for (let i = 0; i < validModels.length; i++) {
    const modelName = validModels[i];
    
    try {
      const useSchema = supportsSchema(modelName);
      console.log(`尝试模型 ${i + 1}/${validModels.length}: ${modelName} (schema: ${useSchema})`);
      return await runAnalysis(modelName, useSchema);
    } catch (error: any) {
      console.warn(`模型 ${modelName} 失败:`, error);
      lastError = error;
      
      // 如果是最后一个模型，抛出错误
      if (i === validModels.length - 1) {
        throw new Error(getFriendlyErrorMessage(error));
      }
      
      // 否则继续尝试下一个模型
      console.log(`继续尝试下一个模型...`);
    }
  }
  
  // 如果所有模型都失败了（理论上不应该到达这里，因为最后一个模型会抛出错误）
  // 但为了安全起见，仍然处理这种情况
  if (lastError) {
    throw new Error(getFriendlyErrorMessage(lastError));
  } else {
    throw new Error("所有模型尝试失败，但没有捕获到具体错误信息");
  }
};