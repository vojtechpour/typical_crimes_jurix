#!/usr/bin/env python3
"""
Script to bulk regenerate candidate themes for all cases with existing themes (Phase 3)
Similar to bulk_regenerate_codes.py but focused on P3 theme regeneration
"""

import json
import argparse
import sys
import datetime
from pathlib import Path
from gemini_api import get_analysis, response_to_json

def log_bulk_progress_update(case_id, new_theme, initial_codes, batch_info, progress_info):
    """Log structured progress update for WebSocket broadcasting"""
    progress_data = {
        "type": "p3_bulk_progress",
        "case_id": case_id,
        "candidate_theme": new_theme,
        "initial_codes": initial_codes if isinstance(initial_codes, list) else [initial_codes],
        "batch_info": batch_info,
        "progress": progress_info,
        "timestamp": datetime.datetime.now().isoformat()
    }
    print(f"P3_BULK_PROGRESS_UPDATE:{json.dumps(progress_data)}")

def create_p3_bulk_regeneration_prompt(cases_batch, custom_instructions, all_existing_themes):
    """Create a prompt for P3 bulk theme regeneration"""
    
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
SPECIAL INSTRUCTIONS FOR THIS BULK REGENERATION:
{custom_instructions}

Please follow these special instructions while maintaining the academic framework and consistency requirements below.

========================================
"""
        base_prompt = instruction_section + base_prompt
    
    # Fill in existing themes for consistency
    if not all_existing_themes:
        themes_text = 'This is the first batch. Hence, there are no candidate themes identified yet.'
    else:
        # Flatten themes and get unique ones
        unique_themes = set()
        for theme in all_existing_themes:
            if isinstance(theme, list):
                unique_themes.update(theme)
            else:
                unique_themes.add(str(theme))
        
        # Take top themes for consistency (limit to prevent token overflow)
        themes_text = '\n'.join(f'- {theme}' for theme in sorted(unique_themes)[:500] if theme.strip())
    
    base_prompt = base_prompt.replace('{{CANDIDATE_THEMES}}', themes_text)
    
    # Format the data for this batch of cases
    cases_data = ""
    for case in cases_batch:
        if isinstance(case['initial_codes'], list):
            codes_text = ', '.join(case['initial_codes'])
        else:
            codes_text = str(case['initial_codes'])
        
        cases_data += f"ID: {case['case_id']}\nInitial codes: [{codes_text}]\n---\n\n"
    
    final_prompt = base_prompt.replace('{{DATA}}', cases_data)
    return final_prompt

def main():
    parser = argparse.ArgumentParser(description='Bulk regenerate candidate themes for all cases with existing themes (Phase 3)')
    parser.add_argument('--filename', required=True, help='Data filename to update')
    parser.add_argument('--instructions', required=True, help='Custom instructions for regeneration')
    parser.add_argument('--cases-data', required=True, help='JSON string of cases with themes to regenerate')
    parser.add_argument('--all-existing-themes', default='[]', help='JSON string of all existing themes for consistency')
    
    args = parser.parse_args()
    
    try:
        # Parse the input data
        cases_data = json.loads(args.cases_data)
        all_existing_themes = json.loads(args.all_existing_themes)
        
        print(f"Starting P3 bulk regeneration for {len(cases_data)} cases", file=sys.stderr)
        
        # Load system prompt
        try:
            with open('data/system_prompt.txt', 'r', encoding='utf-8') as f:
                system_prompt = f.read().strip()
        except FileNotFoundError:
            print("Error: system_prompt.txt not found in data directory", file=sys.stderr)
            sys.exit(1)
        
        # Process cases in batches (smaller batches for P3 since themes are simpler)
        batch_size = 3  # Smaller batches for P3
        updated_themes = {}
        total_batches = (len(cases_data) + batch_size - 1) // batch_size
        
        for batch_idx in range(0, len(cases_data), batch_size):
            batch_cases = cases_data[batch_idx:batch_idx + batch_size]
            current_batch_num = (batch_idx // batch_size) + 1
            
            print(f"Processing batch {current_batch_num}/{total_batches} ({len(batch_cases)} cases)", file=sys.stderr)
            
            # Prepare cases for this batch
            batch_cases_formatted = []
            for case in batch_cases:
                batch_cases_formatted.append({
                    'case_id': case['caseId'],
                    'initial_codes': case['existingCodes'],
                    'existing_theme': case.get('existingTheme', '')
                })
            
            # Create prompt for this batch
            user_prompt = create_p3_bulk_regeneration_prompt(
                cases_batch=batch_cases_formatted,
                custom_instructions=args.instructions,
                all_existing_themes=all_existing_themes
            )
            
            # Get analysis from Gemini
            try:
                response = get_analysis(system_prompt, user_prompt)
                json_result = response_to_json(response)
                
                # Process results for this batch
                for case in batch_cases_formatted:
                    case_id = case['case_id']
                    if case_id in json_result:
                        new_theme = json_result[case_id]
                        updated_themes[case_id] = new_theme
                        
                        # Log progress update
                        progress_info = {
                            "processed": len(updated_themes),
                            "total": len(cases_data),
                            "current_batch": current_batch_num,
                            "total_batches": total_batches,
                            "percentage": round((len(updated_themes) / len(cases_data)) * 100, 1)
                        }
                        
                        batch_info = {
                            "batch_number": current_batch_num,
                            "total_batches": total_batches,
                            "cases_in_batch": len(batch_cases)
                        }
                        
                        log_bulk_progress_update(
                            case_id=case_id,
                            new_theme=new_theme,
                            initial_codes=case['initial_codes'],
                            batch_info=batch_info,
                            progress_info=progress_info
                        )
                    else:
                        print(f"Warning: Case {case_id} not found in API response for batch {current_batch_num}", file=sys.stderr)
                
            except Exception as e:
                print(f"Error processing batch {current_batch_num}: {str(e)}", file=sys.stderr)
                continue
        
        # Return final results
        result = {
            "success": True,
            "updated_themes": updated_themes,
            "updated_cases": len(updated_themes),
            "total_cases": len(cases_data),
            "instructions": args.instructions,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
        print(json.dumps(result))
        print(f"Bulk regeneration completed: {len(updated_themes)}/{len(cases_data)} themes updated", file=sys.stderr)
        
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
            "error": f"Bulk regeneration failed: {str(e)}"
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main() 