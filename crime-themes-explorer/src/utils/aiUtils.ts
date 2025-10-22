export type AiReasoningEffort = "minimal" | "low" | "medium" | "high";
export type AiVerbosity = "low" | "medium" | "high";

export interface AiSettings {
  useGpt5?: boolean;
  model?: string;
  reasoningEffort?: AiReasoningEffort;
  verbosity?: AiVerbosity;
}

export interface ThemeSummary {
  name: string;
  candidateThemes: string[];
}

export interface ChangeContextEntry {
  type: string;
  description: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AiSuggestionAction extends Record<string, unknown> {
  type: string;
}

export interface AiSuggestion {
  id: number;
  type: string;
  title: string;
  description: string;
  action: AiSuggestionAction;
  confidence: number;
}

interface AiServiceResponse {
  content: string;
  [key: string]: unknown;
}

// Real AI suggestion generator using hosted AI API
export const generateAiSuggestions = async (
  changesContext: ChangeContextEntry[],
  currentThemes: ThemeSummary[],
  userInstructions: string,
  aiSettings: AiSettings | null = null
): Promise<AiSuggestion[]> => {
  try {
    const totalCandidates = currentThemes.reduce(
      (sum, theme) => sum + (theme.candidateThemes?.length ?? 0),
      0
    );

    // Prepare the data for AI analysis
    const themeAnalysis = {
      totalThemes: currentThemes.length,
      themes: currentThemes.map((theme) => ({
        name: theme.name,
        candidateCount: theme.candidateThemes.length,
        candidates: theme.candidateThemes,
      })),
      recentChanges: changesContext.slice(0, 10),
      userGoal: userInstructions,
    };

    // Create a comprehensive prompt for the AI
    const prompt = `
You are a friendly AI assistant specializing in crime theme organization. You can have conversations about the data and provide both analytical insights and actionable suggestions.

CURRENT THEME STRUCTURE:
${currentThemes
  .map(
    (theme) =>
      `Theme: "${theme.name}" (${theme.candidateThemes.length} candidates)
  Candidates: ${theme.candidateThemes.join(", ")}`
  )
  .join("\n\n")}

RECENT USER CHANGES:
${
  changesContext.length > 0
    ? changesContext.map((change) => `- ${change.description}`).join("\n")
    : "No recent changes"
}

USER INPUT: "${userInstructions}"

CONVERSATION DETECTION:
First, analyze the user's input to determine if it's:
1. A greeting (ahoj, hello, hi, jak se máš, how are you, etc.)
2. A question about the dataset (what, how, which, where, when, why questions)
3. Casual conversation (comments, observations, general chat)
4. A specific request for theme organization improvements

RESPONSE STRATEGY:
- If it's a greeting, question, or casual conversation: Respond ONLY with an "answer" type suggestion to start a conversation
- If it's a specific organizational request: Provide both conversational answers AND actionable suggestions
- Always be friendly and conversational in your responses

For conversational inputs (greetings, questions, casual chat), provide ONLY ONE response:
{
  "suggestions": [
    {
      "type": "answer",
      "title": "Conversation",
      "description": "AI assistant response to your message",
      "action": {
        "type": "answer",
        "answer": "[Friendly conversational response here]",
        "details": "[Optional additional information as array or string]"
      }
    }
  ]
}

For organizational requests, you may provide multiple suggestions including both answers and actions.

RESPONSE EXAMPLES:

For "ahoj" or "hello":
{
  "suggestions": [
    {
      "type": "answer",
      "title": "Greeting",
      "description": "Friendly hello from your AI assistant",
      "action": {
        "type": "answer",
        "answer": "Ahoj! Jak se máš? I'm here to help you organize your crime theme data. I can see you have ${
          currentThemes.length
        } themes with ${totalCandidates} total candidates. What would you like to know or work on?",
        "details": ["Ask me questions about your data", "Request theme organization suggestions", "Chat about anything related to your dataset"]
      }
    }
  ]
}

For questions like "jak se máš" or "how are you":
{
  "suggestions": [
    {
      "type": "answer",
      "title": "How I'm Doing",
      "description": "AI assistant status and readiness to help",
      "action": {
        "type": "answer",
        "answer": "Mám se dobře, děkuji! I'm doing well and ready to help you with your crime theme analysis. I've been looking at your data and I'm excited to help you organize it better.",
        "details": ["I can analyze your themes", "Suggest improvements", "Answer questions about your data", "Have conversations about crime categorization"]
      }
    }
  ]
}

For dataset questions like "what do you think about this dataset":
{
  "suggestions": [
    {
      "type": "answer",
      "title": "Dataset Analysis",
      "description": "My thoughts on your crime theme dataset",
      "action": {
        "type": "answer",
        "answer": "Your dataset is quite interesting! You have ${
          currentThemes.length
        } main themes covering ${totalCandidates} different crime types. I notice some themes are more populated than others, and there might be opportunities for better organization.",
        "details": [
          "Most populated theme: [theme with most candidates]",
          "Least populated themes: [themes with few candidates]",
          "Potential overlaps I've noticed",
          "Areas for improvement I can suggest"
        ]
      }
    }
  ]
}

ACTIONABLE SUGGESTION TYPES (only use when user specifically requests organizational improvements):
- "move_candidate" - Move a single candidate theme between themes
- "move_multiple_candidates" - Move multiple candidate themes between themes
- "rename_candidate" - Rename a candidate theme
- "rename_theme" - Rename a main theme
- "add_candidate" - Add a new candidate theme
- "delete_candidate" - Delete a candidate theme (MUST include theme name)
- "create_theme" - Create a new main theme with candidates
- "merge_themes" - Merge two main themes
- "merge_candidates" - Merge two candidate themes

IMPORTANT:
- Be conversational and friendly
- Use Czech phrases when appropriate (ahoj, jak se máš, děkuji, etc.)
- For greetings and questions, provide ONLY conversational answers
- Only suggest organizational actions when specifically requested
- Always respond in JSON format
- No additional text outside the JSON

Only return the JSON object, no additional text.`;

    // Log model being used for AI suggestions
    try {
      const modelLabel = aiSettings?.useGpt5
        ? aiSettings?.model || "gpt-5"
        : "claude-3-5-sonnet-20241022";
      console.log(
        `[AI] Generating theme suggestions with model: ${modelLabel}`
      );
    } catch (err) {
      console.warn("Failed to log AI model", err);
    }

    const response = await fetch("/api/ai-suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        themeData: themeAnalysis,
        aiSettings,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const result: AiServiceResponse = await response.json();

    // Parse and validate the AI response
    let suggestionsRaw: unknown = [];
    try {
      console.log("Raw AI response:", result.content);
      const aiResponse = JSON.parse(result.content);
      console.log("Parsed AI response:", aiResponse);
      suggestionsRaw = aiResponse.suggestions ?? [];
      console.log("Extracted suggestions:", suggestionsRaw);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw content:", result.content);
      suggestionsRaw = extractSuggestionsFromText(result.content);
    }

    const validatedSuggestions = (
      Array.isArray(suggestionsRaw) ? suggestionsRaw : []
    )
      .map((suggestion, index): AiSuggestion | null => {
        if (!suggestion || typeof suggestion !== "object") {
          console.warn("Invalid suggestion object:", suggestion);
          return null;
        }

        const action = (suggestion as Record<string, unknown>).action;
        if (!action || typeof action !== "object") {
          console.warn("Invalid action in suggestion:", suggestion);
          return null;
        }

        const suggestionAction = action as AiSuggestionAction;

        return {
          id: Date.now() + index,
          type:
            (suggestion as Record<string, unknown>).type?.toString() ||
            "unknown",
          title:
            (suggestion as Record<string, unknown>).title?.toString() ||
            "Untitled suggestion",
          description:
            (suggestion as Record<string, unknown>).description?.toString() ||
            "No description provided",
          action: {
            ...suggestionAction,
          },
          confidence: Math.min(
            1,
            Math.max(
              0,
              Number((suggestion as Record<string, unknown>).confidence ?? 0.7)
            )
          ),
        };
      })
      .filter((suggestion): suggestion is AiSuggestion => suggestion !== null)
      .slice(0, 10);

    console.log("Final validated suggestions:", validatedSuggestions);
    return validatedSuggestions;
  } catch (error) {
    console.error("Error generating AI suggestions:", error);
    return generateFallbackSuggestions(currentThemes);
  }
};

// Fallback function for when AI service is unavailable
const generateFallbackSuggestions = (
  currentThemes: ThemeSummary[]
): AiSuggestion[] => {
  const suggestions: AiSuggestion[] = [];
  let suggestionId = 1;

  const keywords: Record<string, string[]> = {
    vehicle: ["car", "vehicle", "auto", "truck", "motorcycle", "bike"],
    digital: [
      "cyber",
      "online",
      "digital",
      "internet",
      "computer",
      "electronic",
    ],
    financial: ["credit", "bank", "money", "financial", "payment", "card"],
    identity: ["identity", "personal", "documents", "impersonation", "forgery"],
    drug: ["drug", "narcotic", "substance", "trafficking", "dealing"],
  };

  Object.entries(keywords).forEach(([category, words]) => {
    const matchingCandidates: string[] = [];
    const sourceThemes: string[] = [];

    currentThemes.forEach((theme) => {
      const matches = theme.candidateThemes.filter((candidate) =>
        words.some((keyword) => candidate.toLowerCase().includes(keyword))
      );
      if (matches.length > 0) {
        matchingCandidates.push(...matches);
        sourceThemes.push(theme.name);
      }
    });

    if (matchingCandidates.length >= 3) {
      const titleCategory =
        category.charAt(0).toUpperCase() + category.slice(1);
      suggestions.push({
        id: suggestionId++,
        type: "create",
        title: `Create "${titleCategory} Crime" theme`,
        description: `Found ${matchingCandidates.length} ${category}-related candidates that could form a specialized theme`,
        action: {
          type: "create_theme",
          newThemeName: `${titleCategory} Crime`,
          candidatesToMove: matchingCandidates,
          fromThemes: Array.from(new Set(sourceThemes)),
          reason: `Semantic analysis identified ${matchingCandidates.length} related candidates`,
        },
        confidence: Math.min(0.9, 0.6 + matchingCandidates.length * 0.05),
      });
    }
  });

  return suggestions.slice(0, 5);
};

// Helper function to extract suggestions from unstructured AI text
const extractSuggestionsFromText = (text: string): AiSuggestion[] => {
  console.log("Attempting to parse suggestions from text:", text);
  return [];
};
