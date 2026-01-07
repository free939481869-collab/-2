import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, IssueCategory, IssueSeverity } from "../types";

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
  figmaUrl?: string
): Promise<AnalysisResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing in environment variables");
  }

  // Support for custom Base URL (e.g. proxy)
  // Use 'any' cast because the type definition might not explicitly include baseUrl in all versions, 
  // but it is supported by the underlying client.
  const ai = new GoogleGenAI({ 
    apiKey,
    baseUrl: process.env.API_BASE_URL 
  } as any);

  // 1. Compress images before sending to reduce payload and avoid timeouts
  const [designData, implData] = await Promise.all([
    compressImage(designImageBase64),
    compressImage(implImageBase64)
  ]);

  const basePrompt = `
  请对比这两张图片。
  第一张图是：Figma 设计原稿 (Standard)。
  第二张图是：前端开发实现 (Implementation)。
  ${figmaUrl ? `Figma 链接参考 (Context only): ${figmaUrl}` : ''}
  
  请详细分析还原度问题。请务必严格检查文字大小、颜色差异、间距对齐等细节。
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

  // 3-Tier Fallback Strategy
  try {
    // Tier 1: Gemini 3 Pro (Best Quality)
    return await runAnalysis("gemini-3-pro-preview", true);
  } catch (error: any) {
    console.warn("Tier 1 (Gemini 3 Pro) failed. Trying Tier 2...");
    
    try {
      // Tier 2: Gemini 2.5 Flash Image (Fastest, optimized for images)
      // Note: No responseSchema support
      return await runAnalysis("gemini-2.5-flash-image", false);
    } catch (error2: any) {
       console.warn("Tier 2 (Gemini 2.5 Flash Image) failed. Trying Tier 3...");

       try {
         // Tier 3: Gemini 3 Flash (Backup, supports Schema)
         return await runAnalysis("gemini-3-flash-preview", true);
       } catch (error3: any) {
         console.error("All models failed.");
         throw new Error(getFriendlyErrorMessage(error3));
       }
    }
  }
};