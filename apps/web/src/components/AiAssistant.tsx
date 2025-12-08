import React, { useState } from "react";
import SuggestionItem from "./SuggestionItem";
import type { AiSuggestion } from "../utils/aiUtils";

type AiSettings = {
  model?: string;
  setAiModel?: (m: string) => void;
};

interface AiAssistantProps {
  instructions: string;
  onInstructionsChange: (v: string) => void;
  onAnalyze: (text?: string) => Promise<void> | void;
  isProcessing: boolean;
  suggestions: AiSuggestion[];
  showSuggestions: boolean;
  onApplySuggestion: (s: AiSuggestion) => void;
  onRejectSuggestion: (s: AiSuggestion) => void;
  changesCount: number;
  aiSettings?: AiSettings;
}

const AiAssistant: React.FC<AiAssistantProps> = ({
  instructions,
  onInstructionsChange,
  onAnalyze,
  isProcessing,
  suggestions,
  showSuggestions,
  onApplySuggestion,
  onRejectSuggestion,
  changesCount,
  aiSettings,
}) => {
  const [chatResponses, setChatResponses] = useState<
    Record<string | number, any>
  >({});

  const { model, setAiModel } = aiSettings || {};

  const handleFollowUp = async (
    followUpQuestion: string,
    chatId: string | number | null = null
  ) => {
    if (chatId) {
      // This is a chat follow-up, handle it directly without creating new suggestions
      try {
        // Get current theme data for context
        const themeContext =
          suggestions.length > 0
            ? suggestions
                .map((s) => {
                  const details = (
                    s.action as Record<string, unknown> | undefined
                  )?.details;
                  if (Array.isArray(details)) {
                    return details.join(", ");
                  }
                  if (typeof details === "string") {
                    return details;
                  }
                  return null;
                })
                .filter((v): v is string => Boolean(v))
                .join(", ")
            : "No current theme data available";

        // Call the AI API directly for chat responses with thematic analysis context
        // Log model for chat follow-up
        const modelToUse = model || "gemini-2.0-flash";
        console.log(`[AI] Chat follow-up using model: ${modelToUse}`);

        const response = await fetch("/api/ai-suggestions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `You are a friendly AI assistant specializing in crime theme organization and thematic analysis methodology. 

THEMATIC ANALYSIS CONTEXT:
You have deep knowledge of the 6-phase thematic analysis methodology used in this system:

PHASE 1: FAMILIARIZING WITH DATA - Reading and understanding the crime case data
PHASE 2: GENERATING INITIAL CODES - Creating systematic behavioral codes (e.g., "shoplifting_alcohol", "bike_theft_locked_storage")
PHASE 3: SEARCHING FOR THEMES - Converting codes into candidate themes (e.g., "Residential_Building_Theft", "Vehicle_Related_Crime")
PHASE 3B: FINALIZING THEMES - Refining and consolidating themes into final categories
PHASE 4: REVIEWING THEMES - Checking theme consistency and coverage
PHASE 5: DEFINING THEMES - Creating clear definitions and names
PHASE 6: REPORTING - Final analysis and documentation

CODING METHODOLOGY:
- Initial codes focus on: victim autonomy impact, methods/means, offender motivation, consequences, habitual patterns
- Multiple atomic codes per case (3-4 focused codes, max 5)
- Systematic underscore format (e.g., "theft_of_bicycle_from_shared_space")
- One idea per code approach
- Semantic-level codes describing explicit content

THEME DEVELOPMENT:
- Candidate themes group similar criminal activities/methods
- Use criminological terminology
- Focus on criminal method, target, or context
- Balance specificity with generalizability
- Ensure mutual exclusivity and comprehensive coverage

CURRENT CONTEXT: ${themeContext}

USER QUESTION: "${followUpQuestion}"

IMPORTANT: Respond naturally and conversationally. Write your response as a single, flowing conversation - don't split it into separate "response" and "details" sections. If you need to mention multiple points, incorporate them naturally into your conversational response.

Respond in JSON format:
{
  "response": "Your complete conversational response here - include all information in a natural, flowing way without needing separate details"
}

Only return the JSON object, no additional text.`,
            themeData: {}, // We can pass theme data if needed for context
            aiSettings: { model: modelToUse },
          }),
        });

        if (!response.ok) {
          throw new Error(`AI service error: ${response.status}`);
        }

        const result = await response.json();

        try {
          const aiResponse = JSON.parse(result.content);

          const chatResponse = {
            chatId: chatId,
            content:
              aiResponse.response ||
              `I understand you asked: "${followUpQuestion}". Let me help you with that!`,
            timestamp: new Date(),
          };

          setChatResponses((prev) => ({
            ...prev,
            [chatId]: chatResponse,
          }));
        } catch (parseError) {
          console.error("Error parsing AI chat response:", parseError);
          // Fallback response with thematic analysis knowledge
          const fallbackResponse = {
            chatId: chatId,
            content: `Thanks for asking "${followUpQuestion}". I'm here to help you with your crime theme organization using systematic thematic analysis methodology. I understand the 6-phase process from initial coding to final theme development. Feel free to ask me about any aspect of thematic analysis, coding methodology, or your current theme structure!`,
            timestamp: new Date(),
          };

          setChatResponses((prev) => ({
            ...prev,
            [chatId]: fallbackResponse,
          }));
        }
      } catch (error) {
        console.error("Error processing chat follow-up:", error);
        // Error response
        const errorResponse = {
          chatId: chatId,
          content:
            "Sorry, I encountered an error processing your message. Please try again.",
          details: ["Check your connection", "Try rephrasing your question"],
          timestamp: new Date(),
          isError: true,
        };

        setChatResponses((prev) => ({
          ...prev,
          [chatId]: errorResponse,
        }));
      }
    } else {
      // Regular follow-up, use existing behavior
      await onAnalyze(followUpQuestion);
    }
  };

  return (
    <div className="ai-assistant">
      <div className="ai-assistant-header">
        <h5>AI Theme Assistant</h5>
        <span className="changes-count">{changesCount} changes to analyze</span>
      </div>

      <div className="ai-instructions-section">
        {/* AI Settings */}
        {aiSettings && (
          <div
            className="row"
            style={{ alignItems: "center", marginBottom: 12 }}
          >
            <label htmlFor="ai-model-select" className="muted">
              Model
            </label>
            <select
              id="ai-model-select"
              className="select"
              value={model || "gemini-2.0-flash"}
              onChange={(e) => setAiModel && setAiModel(e.target.value)}
            >
              <option value="gemini-3-pro-preview">
                Gemini 3 Pro Preview (suggested)
              </option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-flash-lite">
                Gemini 2.5 Flash-Lite
              </option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-2.0-flash-lite">
                Gemini 2.0 Flash-Lite
              </option>
              <option value="claude-sonnet-4-5-20250929">
                Claude Sonnet 4.5
              </option>
              <option value="claude-haiku-4-5-20251015">
                Claude Haiku 4.5
              </option>
              <option value="claude-sonnet-4-20250514">
                Claude Sonnet 4
              </option>
              <option value="gpt-5-2025-08-07">gpt-5-2025-08-07</option>
              <option value="gpt-5-mini-2025-08-07">
                gpt-5-mini-2025-08-07
              </option>
              <option value="gpt-5-nano-2025-08-07">
                gpt-5-nano-2025-08-07
              </option>
            </select>
          </div>
        )}

        <textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Optional: Describe what you're trying to achieve with your theme organization (e.g., 'Make categories more specific', 'Group similar theft types', 'Simplify the structure')..."
          className="ai-instructions-input"
          rows={3}
        />

        <button
          onClick={() => onAnalyze()}
          disabled={isProcessing}
          className="ai-analyze-btn"
        >
          {isProcessing ? (
            <>
              <span className="loading-spinner">...</span>
              Analyzing...
            </>
          ) : (
            <>Analyze & Suggest</>
          )}
        </button>
      </div>

      {showSuggestions && suggestions && (
        <div className="ai-suggestions">
          <div className="suggestions-header">
            <h6>AI Suggestions ({suggestions.length})</h6>
            <p>Review and apply the suggestions you find helpful:</p>
          </div>

          <div className="suggestions-list">
            {suggestions.length === 0 ? (
              <div className="no-suggestions">
                No suggestions generated. Try making more theme modifications
                first.
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <SuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion as any}
                  onApply={onApplySuggestion}
                  onReject={onRejectSuggestion}
                  onFollowUp={handleFollowUp}
                  aiResponse={chatResponses[suggestion.id]}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiAssistant;
