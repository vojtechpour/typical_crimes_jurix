import React, { useState, useEffect } from "react";

type Suggestion = {
  id: string | number;
  type: string;
  title?: string;
  description?: string;
  confidence?: number;
  action: any;
};

interface Props {
  suggestion: Suggestion;
  onApply: (s: Suggestion) => void;
  onReject: (s: Suggestion) => void;
  onFollowUp: (
    text: string,
    chatId?: string | number | null
  ) => Promise<void> | void;
  aiResponse?: any;
}

const SuggestionItem: React.FC<Props> = ({
  suggestion,
  onApply,
  onReject,
  onFollowUp,
  aiResponse,
}) => {
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isProcessingChat, setIsProcessingChat] = useState<boolean>(false);

  // Handle incoming AI responses for this chat
  useEffect(() => {
    if (aiResponse && aiResponse.chatId === suggestion.id) {
      const aiMessage = {
        id: Date.now(),
        type: "ai",
        content: aiResponse.content,
        timestamp: new Date(),
        details: aiResponse.details,
      };

      setChatMessages((prev) => [...prev, aiMessage]);
      setIsProcessingChat(false);
    }
  }, [aiResponse, suggestion.id]);

  const handleChatSubmit = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: "user",
      content: currentMessage.trim(),
      timestamp: new Date(),
    };

    // Add user message to chat
    setChatMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setIsProcessingChat(true);

    try {
      // Send the message to AI with chat context
      await onFollowUp(currentMessage.trim(), suggestion.id);
    } catch (error) {
      console.error("Error processing chat message:", error);
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        type: "ai",
        content:
          "Sorry, I encountered an error processing your message. Please try again.",
        timestamp: new Date(),
        isError: true,
      };
      setChatMessages((prev) => [...prev, errorMessage]);
      setIsProcessingChat(false);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "move":
        return "🔄";
      case "rename":
        return "✏️";
      case "create":
        return "➕";
      case "delete":
        return "🗑️";
      case "merge":
        return "🔗";
      case "answer":
        return "💬";
      default:
        return "💡";
    }
  };

  const getConfidenceColor = (confidence: number = 0) => {
    if (confidence >= 0.8) return "high-confidence";
    if (confidence >= 0.6) return "medium-confidence";
    return "low-confidence";
  };

  const renderActionDetails = (action: any) => {
    if (!action || !action.type) {
      return <span className="action-detail">Invalid action data</span>;
    }

    switch (action.type) {
      case "move_candidate":
        return (
          <span className="action-detail">
            Move "{action.candidateTheme || "Unknown"}" from "
            {action.fromTheme || "Unknown"}" to "{action.toTheme || "Unknown"}"
          </span>
        );

      case "move_multiple_candidates":
        const candidates = action.candidates || [];
        return (
          <span className="action-detail">
            Move candidates: <strong>{candidates.join(", ")}</strong> from "
            {action.fromTheme || "Unknown"}" to "{action.toTheme || "Unknown"}"
          </span>
        );

      case "rename_candidate":
        return (
          <span className="action-detail">
            Rename "{action.currentName || "Unknown"}" to "
            {action.suggestedName || "Unknown"}"
          </span>
        );

      case "rename_theme":
        return (
          <span className="action-detail">
            Rename theme "{action.currentName || "Unknown"}" to "
            {action.suggestedName || "Unknown"}"
          </span>
        );

      case "add_candidate":
        return (
          <span className="action-detail">
            Add "{action.candidateTheme || "Unknown"}" to "
            {action.theme || "Unknown"}"
          </span>
        );

      case "delete_candidate":
        return (
          <span className="action-detail">
            Delete "{action.candidateTheme || "Unknown"}" from "
            {action.theme || "Unknown"}"
          </span>
        );

      case "create_theme":
        const candidatesToMove = action.candidatesToMove || [];
        const fromThemes = action.fromThemes || [];
        return (
          <span className="action-detail">
            Create new theme "{action.newThemeName || "Unknown"}" with
            candidates: <strong>{candidatesToMove.join(", ")}</strong>
            {fromThemes.length > 0 && (
              <span>
                {" "}
                from themes: <strong>{fromThemes.join(", ")}</strong>
              </span>
            )}
            {action.fromTheme && (
              <span>
                {" "}
                from theme: <strong>{action.fromTheme}</strong>
              </span>
            )}
          </span>
        );

      case "merge_themes":
        return (
          <span className="action-detail">
            Merge "{action.theme1 || "Unknown"}" and "
            {action.theme2 || "Unknown"}" into "
            {action.newThemeName || "Unknown"}"
          </span>
        );

      case "merge_candidates":
        return (
          <span className="action-detail">
            Merge "{action.candidate1 || "Unknown"}" and "
            {action.candidate2 || "Unknown"}" into "
            {action.newName || "Unknown"}" in "{action.theme || "Unknown"}"
          </span>
        );

      case "answer":
        return (
          <div className="answer-content">
            <div className="chat-container">
              {/* Initial AI Response */}
              <div className="chat-message ai-message">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="message-text">
                    {action.answer || "No answer provided"}
                  </div>
                  {action.details && (
                    <div className="message-details">
                      {Array.isArray(action.details) ? (
                        <ul>
                          {action.details.map((detail: any, index: number) => (
                            <li key={index}>{detail}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>{action.details}</p>
                      )}
                    </div>
                  )}
                  <div className="message-timestamp">
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message ${message.type}-message`}
                >
                  <div className="message-avatar">
                    {message.type === "user" ? "👤" : "🤖"}
                  </div>
                  <div className="message-content">
                    <div
                      className={`message-text ${
                        message.isError ? "error-message" : ""
                      }`}
                    >
                      {message.content}
                    </div>
                    {/* Only show details for error messages or if explicitly needed */}
                    {message.isError && message.details && (
                      <div className="message-details">
                        {Array.isArray(message.details) ? (
                          <ul>
                            {message.details.map(
                              (detail: any, index: number) => (
                                <li key={index}>{detail}</li>
                              )
                            )}
                          </ul>
                        ) : (
                          <p>{message.details}</p>
                        )}
                      </div>
                    )}
                    <div className="message-timestamp">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Processing Indicator */}
              {isProcessingChat && (
                <div className="chat-message ai-message processing">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="message-text">
                      <span className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="chat-input-section">
              <div className="chat-input-container">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleChatKeyPress}
                  placeholder="Ask a follow-up question or continue the conversation..."
                  className="chat-input"
                  rows={2}
                  disabled={isProcessingChat}
                />

                <button
                  onClick={handleChatSubmit}
                  disabled={isProcessingChat || !currentMessage.trim()}
                  className="chat-send-btn"
                >
                  {isProcessingChat ? (
                    <span className="loading-spinner">⏳</span>
                  ) : (
                    "💬"
                  )}
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <span className="action-detail">
            Unknown action type: {action.type}
          </span>
        );
    }
  };

  const isAnswerType = suggestion.type === "answer";

  return (
    <div className="suggestion-item">
      <div className="suggestion-content">
        <div className="suggestion-header">
          <span className="suggestion-icon">
            {getSuggestionIcon(suggestion.type)}
          </span>
          <span className="suggestion-title">{suggestion.title}</span>
          {!isAnswerType && (
            <span
              className={`confidence-badge ${getConfidenceColor(
                suggestion.confidence
              )}`}
            >
              {Math.round((suggestion.confidence || 0) * 100)}%
            </span>
          )}
        </div>

        <p className="suggestion-description">{suggestion.description}</p>

        {suggestion.action?.reason && !isAnswerType && (
          <p className="suggestion-reason">
            <strong>Reasoning:</strong> {suggestion.action.reason}
          </p>
        )}

        <div className="suggestion-details">
          {renderActionDetails(suggestion.action)}
        </div>
      </div>

      {!isAnswerType && (
        <div className="suggestion-actions">
          <button
            onClick={() => onApply(suggestion)}
            className="apply-suggestion-btn"
            title="Apply this suggestion"
          >
            ✅ Apply
          </button>
          <button
            onClick={() => onReject(suggestion)}
            className="reject-suggestion-btn"
            title="Reject this suggestion"
          >
            ❌ Reject
          </button>
        </div>
      )}
    </div>
  );
};

export default SuggestionItem;
