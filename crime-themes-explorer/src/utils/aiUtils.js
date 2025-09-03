// Real AI suggestion generator using OpenAI API
export const generateAiSuggestions = async (
  changesContext,
  currentThemes,
  userInstructions,
  aiSettings = null
) => {
  try {
    // Prepare the data for AI analysis
    const themeAnalysis = {
      totalThemes: currentThemes.length,
      themes: currentThemes.map((theme) => ({
        name: theme.name,
        candidateCount: theme.candidateThemes.length,
        candidates: theme.candidateThemes,
      })),
      recentChanges: changesContext.slice(0, 10), // Last 10 changes
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
        } themes with ${currentThemes.reduce(
      (sum, theme) => sum + theme.candidateThemes.length,
      0
    )} total candidates. What would you like to know or work on?",
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
        } main themes covering ${currentThemes.reduce(
      (sum, theme) => sum + theme.candidateThemes.length,
      0
    )} different crime types. I notice some themes are more populated than others, and there might be opportunities for better organization.",
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
    } catch {}

    // Call OpenAI API
    const response = await fetch("/api/ai-suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        themeData: themeAnalysis,
        aiSettings: aiSettings,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const result = await response.json();

    // Parse and validate the AI response
    let suggestions = [];
    try {
      console.log("Raw AI response:", result.content);
      const aiResponse = JSON.parse(result.content);
      console.log("Parsed AI response:", aiResponse);
      suggestions = aiResponse.suggestions || [];
      console.log("Extracted suggestions:", suggestions);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw content:", result.content);
      // Fallback to extracting suggestions from text response
      suggestions = extractSuggestionsFromText(result.content);
    }

    // Add unique IDs and validate suggestions
    const validatedSuggestions = suggestions
      .map((suggestion, index) => {
        // Validate suggestion structure
        if (!suggestion || typeof suggestion !== "object") {
          console.warn("Invalid suggestion object:", suggestion);
          return null;
        }

        if (!suggestion.action || typeof suggestion.action !== "object") {
          console.warn("Invalid action in suggestion:", suggestion);
          return null;
        }

        return {
          id: Date.now() + index,
          type: suggestion.type || "unknown",
          title: suggestion.title || "Untitled suggestion",
          description: suggestion.description || "No description provided",
          action: {
            type: suggestion.action.type || "unknown",
            ...suggestion.action,
          },
          confidence: Math.min(
            1.0,
            Math.max(0.0, suggestion.confidence || 0.7)
          ),
        };
      })
      .filter((suggestion) => suggestion !== null)
      .slice(0, 10); // Limit to 10 suggestions

    console.log("Final validated suggestions:", validatedSuggestions);
    return validatedSuggestions;
  } catch (error) {
    console.error("Error generating AI suggestions:", error);

    // Fallback to local analysis if AI service fails
    return generateFallbackSuggestions(currentThemes, userInstructions);
  }
};

// Fallback function for when AI service is unavailable
const generateFallbackSuggestions = (currentThemes, userInstructions) => {
  const suggestions = [];
  let suggestionId = 1;

  // Simple keyword-based analysis as fallback
  const keywords = {
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
    const matchingCandidates = [];
    const sourceThemes = [];

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
      suggestions.push({
        id: suggestionId++,
        type: "create",
        title: `Create "${
          category.charAt(0).toUpperCase() + category.slice(1)
        } Crime" theme`,
        description: `Found ${matchingCandidates.length} ${category}-related candidates that could form a specialized theme`,
        action: {
          type: "create_theme",
          newThemeName: `${
            category.charAt(0).toUpperCase() + category.slice(1)
          } Crime`,
          candidatesToMove: matchingCandidates,
          fromThemes: [...new Set(sourceThemes)],
          reason: `Semantic analysis identified ${matchingCandidates.length} related candidates`,
        },
        confidence: Math.min(0.9, 0.6 + matchingCandidates.length * 0.05),
      });
    }
  });

  return suggestions.slice(0, 5);
};

// Helper function to extract suggestions from unstructured AI text
const extractSuggestionsFromText = (text) => {
  // This would parse suggestions from natural language AI response
  // For now, return empty array - implement based on your AI service response format
  console.log("Attempting to parse suggestions from text:", text);
  return [];
};
