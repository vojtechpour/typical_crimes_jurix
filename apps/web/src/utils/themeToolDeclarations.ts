// Function declarations for theme manipulation tools
// Compatible with Gemini's function calling schema

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

export const themeToolDeclarations: FunctionDeclaration[] = [
  {
    name: "move_theme",
    description: "Moves a candidate theme from one theme group to another",
    parameters: {
      type: "object",
      properties: {
        candidateTheme: {
          type: "string",
          description: "The candidate theme to move",
        },
        fromGroup: {
          type: "string",
          description: "Source theme group name",
        },
        toGroup: {
          type: "string",
          description: "Destination theme group name",
        },
      },
      required: ["candidateTheme", "fromGroup", "toGroup"],
    },
  },
  {
    name: "merge_themes",
    description: "Merges two candidate themes into one with a new name",
    parameters: {
      type: "object",
      properties: {
        theme1: {
          type: "string",
          description: "First theme to merge",
        },
        theme2: {
          type: "string",
          description: "Second theme to merge",
        },
        newName: {
          type: "string",
          description: "Name for the merged theme",
        },
      },
      required: ["theme1", "theme2", "newName"],
    },
  },
  {
    name: "rename_theme",
    description: "Renames a theme group or candidate theme",
    parameters: {
      type: "object",
      properties: {
        oldName: {
          type: "string",
          description: "Current name of the theme",
        },
        newName: {
          type: "string",
          description: "New name for the theme",
        },
        themeType: {
          type: "string",
          enum: ["group", "candidate"],
          description:
            "Type of theme: 'group' for theme groups, 'candidate' for candidate themes",
        },
      },
      required: ["oldName", "newName", "themeType"],
    },
  },
  {
    name: "create_theme_group",
    description:
      "Creates a new theme group/category to organize candidate themes",
    parameters: {
      type: "object",
      properties: {
        groupName: {
          type: "string",
          description: "Name for the new theme group",
        },
      },
      required: ["groupName"],
    },
  },
  {
    name: "delete_theme",
    description: "Deletes a candidate theme or theme group",
    parameters: {
      type: "object",
      properties: {
        themeName: {
          type: "string",
          description: "Name of the theme to delete",
        },
        themeType: {
          type: "string",
          enum: ["group", "candidate"],
          description:
            "Type of theme: 'group' for theme groups, 'candidate' for candidate themes",
        },
      },
      required: ["themeName", "themeType"],
    },
  },
];

// Type for function call results from the model
export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

// Type for tool execution result
export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

