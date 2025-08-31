#!/usr/bin/env python3
"""
Script to regenerate candidate themes for individual cases (Phase 3)
Similar to regenerate_codes.py but focused on P3 theme generation
"""

import json
import argparse
import sys
from pathlib import Path
from gemini_api import get_analysis, response_to_json

def create_p3_regeneration_prompt(case_id, initial_codes, custom_instructions, existing_theme, all_existing_themes):
    """Create a prompt for P3 theme regeneration"""
    
    # Load the phase 3 prompt template
    try:
        with open('data/phase_3_prompt.txt', 'r', encoding='utf-8') as f:
            base_prompt = f.read().strip()
    except FileNotFoundError:
        print("Error: phase_3_prompt.txt not found in data directory", file=sys.stderr)
        sys.exit(1)
    
    # Add custom instructions if provided
    if custom_instructions:
        instruction_section = f"""
SPECIAL INSTRUCTIONS FOR THIS REGENERATION:
{custom_instructions}

Please follow these special instructions while maintaining the academic framework and consistency requirements below.

========================================
"""
        base_prompt = instruction_section + base_prompt
    
    # Fill in existing themes for consistency
    if not all_existing_themes:
        themes_text = 'This is the first case. Hence, there are no candidate themes identified yet.'
    else:
        # Flatten themes and get unique ones
        unique_themes = set()
        for theme in all_existing_themes:
            if isinstance(theme, list):
                unique_themes.update(theme)
            else:
                unique_themes.add(str(theme))
        
        themes_text = '\n'.join(f'- {theme}' for theme in sorted(unique_themes) if theme.strip())
    
    base_prompt = base_prompt.replace('{{CANDIDATE_THEMES}}', themes_text)
    
    # Format the data for this specific case
    if isinstance(initial_codes, list):
        codes_text = ', '.join(initial_codes)
    else:
        codes_text = str(initial_codes)
    
    case_data = f"ID: {case_id}\nInitial codes: [{codes_text}]\n---\n\n"
    final_prompt = base_prompt.replace('{{DATA}}', case_data)
    
    return final_prompt

def main():
    parser = argparse.ArgumentParser(description='Regenerate candidate theme for a specific case (Phase 3)')
    parser.add_argument('--case-id', required=True, help='Case ID to regenerate theme for')
    parser.add_argument('--initial-codes', required=True, help='JSON string of initial codes for the case')
    parser.add_argument('--instructions', default='', help='Custom instructions for regeneration')
    parser.add_argument('--existing-theme', default='', help='Current theme for the case')
    parser.add_argument('--all-existing-themes', default='[]', help='JSON string of all existing themes for consistency')
    
    args = parser.parse_args()
    
    try:
        # Parse the input data
        initial_codes = json.loads(args.initial_codes)
        all_existing_themes = json.loads(args.all_existing_themes)
        
        # Create the regeneration prompt
        user_prompt = create_p3_regeneration_prompt(
            case_id=args.case_id,
            initial_codes=initial_codes,
            custom_instructions=args.instructions,
            existing_theme=args.existing_theme,
            all_existing_themes=all_existing_themes
        )
        
        # Load system prompt
        try:
            with open('data/system_prompt.txt', 'r', encoding='utf-8') as f:
                system_prompt = f.read().strip()
        except FileNotFoundError:
            print("Error: system_prompt.txt not found in data directory", file=sys.stderr)
            sys.exit(1)
        
        # Get analysis from Gemini
        response = get_analysis(system_prompt, user_prompt)
        json_result = response_to_json(response)
        
        # Extract the theme for this case
        if args.case_id in json_result:
            new_theme = json_result[args.case_id]
            
            # Return success result
            result = {
                "success": True,
                "case_id": args.case_id,
                "theme": new_theme,
                "instructions": args.instructions,
                "timestamp": "regenerated"
            }
            
            print(json.dumps(result))
            
        else:
            # Return error if case not found in response
            result = {
                "success": False,
                "error": f"Case {args.case_id} not found in API response",
                "raw_response": json_result
            }
            print(json.dumps(result))
            sys.exit(1)
            
    except json.JSONDecodeError as e:
        result = {
            "success": False,
            "error": f"JSON parsing error: {str(e)}"
        }
        print(json.dumps(result))
        sys.exit(1)
        
    except Exception as e:
        result = {
            "success": False,
            "error": f"Regeneration failed: {str(e)}"
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main() 