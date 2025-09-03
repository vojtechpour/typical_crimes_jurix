import React, { useState } from "react";
import SuggestionItem from "./SuggestionItem";

type Suggestion = {
  id: string | number;
  type?: string;
  title?: string;
  description?: string;
  action?: any;
};

type AiSettings = {
  useGpt5?: boolean;
  model?: string;
  reasoningEffort?: string;
  verbosity?: string;
  setUseGpt5?: (v: boolean) => void;
  setAiModel?: (m: string) => void;
  setReasoningEffort?: (v: string) => void;
  setVerbosity?: (v: string) => void;
};

interface AiAssistantProps {
  instructions: string;
  onInstructionsChange: (v: string) => void;
  onAnalyze: (text?: string) => Promise<void> | void;
  isProcessing: boolean;
  suggestions: Suggestion[];
  showSuggestions: boolean;
  onApplySuggestion: (s: Suggestion) => void;
  onRejectSuggestion: (s: Suggestion) => void;
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
  const [chatResponses, setChatResponses] = useState<Record<string | number, any>>({});

  const { useGpt5, model, reasoningEffort, verbosity, setUseGpt5, setAiModel, setReasoningEffort, setVerbosity } =
    aiSettings || {};

  const handleFollowUp = async (followUpQuestion: string, chatId: string | number | null = null) => {
    if (chatId) {
      // This is a chat follow-up, handle it directly without creating new suggestions
      try {
        // Get current theme data for context
        const themeContext =
          suggestions?.length > 0
            ? suggestions.map((s) => (s as any).action?.details || []).flat().join(", ")
            : "No current theme data available";

        // Call the AI API directly for chat responses with thematic analysis context
        // Log model for chat follow-up
        try {
          const modelLabel = useGpt5 ? model || "gpt-5" : "claude-3-5-sonnet-20241022";
          console.log(`[AI] Chat follow-up using model: ${modelLabel}`);
        } catch {}

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
            aiSettings: useGpt5
              ? { useGpt5, model, reasoningEffort, verbosity }
              : { useGpt5: false },
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
              aiResponse.response || `I understand you asked: "${followUpQuestion}". Let me help you with that!`,
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
          content: "Sorry, I encountered an error processing your message. Please try again.",
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
        <h5>🤖 AI Theme Assistant</h5>
        <span className="changes-count">{changesCount} changes to analyze</span>
      </div>

      <div className="ai-instructions-section">
        {/* AI Settings */}
        {aiSettings && (
          <div className="ai-settings" style={{ marginBottom: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!useGpt5}
                onChange={(e) => setUseGpt5 && setUseGpt5(e.target.checked)}
              />
              Using GPT-5
            </label>

            {useGpt5 && (
              <div
                className="ai-settings-row"
                style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}
              >
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>Model</span>
                  <select value={model || "gpt-5"} onChange={(e) => setAiModel && setAiModel(e.target.value)}>
                    <option value="gpt-5">gpt-5</option>
                    <option value="gpt-5-mini">gpt-5-mini</option>
                    <option value="gpt-5-nano">gpt-5-nano</option>
                    <option value="gpt-5-2025-08-07">gpt-5-2025-08-07</option>
                    <option value="gpt-5-mini-2025-08-07">gpt-5-mini-2025-08-07</option>
                    <option value="gpt-5-nano-2025-08-07">gpt-5-nano-2025-08-07</option>
                  </select>
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>Reasoning</span>
                  <select
                    value={reasoningEffort || "medium"}
                    onChange={(e) => setReasoningEffort && setReasoningEffort(e.target.value)}
                  >
                    <option value="minimal">minimal</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>Verbosity</span>
                  <select value={verbosity || "medium"} onChange={(e) => setVerbosity && setVerbosity(e.target.value)}>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}

        <textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Optional: Describe what you're trying to achieve with your theme organization (e.g., 'Make categories more specific', 'Group similar theft types', 'Simplify the structure')..."
          className="ai-instructions-input"
          rows={3}
        />

        <button onClick={() => onAnalyze()} disabled={isProcessing} className="ai-analyze-btn">
          {isProcessing ? (
            <>
              <span className="loading-spinner">⏳</span>
              Analyzing...
            </>
          ) : (
            <>🧠 Analyze & Suggest</>
          )}
        </button>
      </div>

      {showSuggestions && suggestions && (
        <div className="ai-suggestions">
          <div className="suggestions-header">
            <h6>💡 AI Suggestions ({suggestions.length})</h6>
            <p>Review and apply the suggestions you find helpful:</p>
          </div>

          <div className="suggestions-list">
            {suggestions.length === 0 ? (
              <div className="no-suggestions">No suggestions generated. Try making more theme modifications first.</div>
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
