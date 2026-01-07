import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, IssueCategory, IssueSeverity } from "../types";

// Helper to remove data URL prefix for Gemini API
const cleanBase64 = (base64: string) => {
  return base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
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

export const analyzeUiDifferences = async (
  designImageBase64: string,
  implImageBase64: string,
  figmaUrl?: string
): Promise<AnalysisResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  const basePrompt = `
  请对比这两张图片。
  第一张图是：Figma 设计原稿 (Standard)。
  第二张图是：前端开发实现 (Implementation)。
  ${figmaUrl ? `Figma 链接参考 (Context only): ${figmaUrl}` : ''}
  
  请详细分析还原度问题。请务必严格检查文字大小、颜色差异、间距对齐等细节。
  对于每个问题，请准确标注在第二张图（实现图）上的位置坐标 (boundingBox)，使用 [ymin, xmin, ymax, xmax] (0-1000 scale) 格式。
  `;

  // Helper function to run analysis with a specific model and configuration
  const runAnalysis = async (modelName: string, useSchema: boolean) => {
    console.log(`Analyzing with model: ${modelName}, useSchema: ${useSchema}`);

    // If schema is not supported, we must ask for JSON in the prompt explicitly
    const finalPrompt = useSchema 
      ? basePrompt 
      : basePrompt + "\n请直接输出 JSON 格式结果。不要使用 Markdown 代码块。JSON 结构需包含 score (number), summary (string), issues (array of objects with category, severity, description, suggestion, location, boundingBox).";

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
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
            { inlineData: { mimeType: "image/png", data: cleanBase64(designImageBase64) } },
            { inlineData: { mimeType: "image/png", data: cleanBase64(implImageBase64) } }
          ]
        },
        config
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      // Attempt to parse JSON. 
      // If we didn't use schema, the model might wrap it in markdown ```json ... ```
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleanedText) as AnalysisResult;

    } catch (e: any) {
      console.warn(`Analysis failed with model ${modelName}:`, e);
      throw e;
    }
  };

  try {
    // 1. Try Gemini 3 Pro first (Smartest, supports Schema)
    return await runAnalysis("gemini-3-pro-preview", true);
  } catch (error: any) {
    console.warn("Gemini 3 Pro failed, switching to Nano Banana (gemini-2.5-flash-image)...", error);
    
    // 2. Fallback to Nano Banana (gemini-2.5-flash-image) as requested.
    // Note: Nano Banana models do NOT support responseSchema or responseMimeType.
    try {
      return await runAnalysis("gemini-2.5-flash-image", false);
    } catch (fallbackError) {
      console.error("Nano Banana fallback also failed:", fallbackError);
      throw error; // Throw the original error or the new one
    }
  }
};