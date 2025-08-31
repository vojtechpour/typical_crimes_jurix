#!/usr/bin/env python3
"""
Code Regeneration Script
Regenerates initial codes for a specific case using custom user instructions
"""

import argparse
import json
import sys
import logging
from pathlib import Path
from gemini_api import get_analysis, response_to_json

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
MODEL = 'gemini-2.0-flash'
DATA_DIR = Path('data')
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'

def load_system_prompt():
    """Load the system prompt from file"""
    try:
        with open(SYSTEM_PROMPT_FILE, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        logger.error(f"System prompt file not found: {SYSTEM_PROMPT_FILE}")
        return "You are an expert in thematic analysis of crime data. Generate precise and specific initial codes for the given case."

def create_regeneration_prompt(case_text, existing_codes, user_instructions, all_existing_codes=None):
    """Create a prompt for code regeneration using the same structure as main analysis"""
    
    # Load the Phase 2 prompt template (same as main analysis and bulk regeneration)
    try:
        phase_2_prompt_file = DATA_DIR / 'phase_2_prompt.txt'
        with open(phase_2_prompt_file, 'r') as f:
            base_prompt = f.read().strip()
    except FileNotFoundError:
        logger.error(f"Phase 2 prompt file not found: {phase_2_prompt_file}")
        # Fallback to basic prompt
        base_prompt = """THEMATIC ANALYSIS - PHASE 2: GENERATING INITIAL CODES
Generate initial codes that capture interesting features of the crime data.
Codes should describe the most basic meaningful elements of criminal behavior.
Use structured underscore format (e.g., "shoplifting_alcohol", "theft_of_bicycle").
Output as JSON with case IDs as keys and arrays of codes as values.

EXISTING CODES FROM PREVIOUS ANALYSIS
{{INITIAL_CODES}}

CRIME CASE TO ANALYZE
{{DATA}}"""

    # Prepare existing codes section (for consistency)
    if all_existing_codes:
        # Get unique codes from all existing data
        all_codes = set()
        for codes in all_existing_codes:
            if isinstance(codes, list):
                all_codes.update(str(code) for code in codes)
            else:
                all_codes.add(str(codes))
        
        if all_codes:
            codes_text = '\n'.join(f'- {code}'.replace('\n', ' ') for code in sorted(all_codes))
        else:
            codes_text = 'No existing codes available for consistency reference.'
    else:
        codes_text = 'No existing codes available for consistency reference.'
    
    # Replace the existing codes placeholder
    base_prompt = base_prompt.replace('{{INITIAL_CODES}}', codes_text)
    
    # Add user instructions if provided (same approach as main analysis)
    if user_instructions and user_instructions.strip():
        instructions_section = f"""

SPECIAL INSTRUCTIONS FOR CODE GENERATION:
{user_instructions.strip()}

Please prioritize these instructions while maintaining accuracy and consistency with existing codes, following all the academic guidelines and formatting requirements specified above.
"""
        # Insert instructions before the data section
        base_prompt = base_prompt.replace('{{DATA}}', instructions_section + '\n\n{{DATA}}')
        logger.info(f"Added user instructions to regeneration prompt")
    
    # Create the data section for the specific case
    existing_codes_text = ""
    if existing_codes:
        if isinstance(existing_codes, list):
            existing_codes_text = ', '.join(f'"{code}"' for code in existing_codes)
        else:
            existing_codes_text = f'"{existing_codes}"'
    
    case_data = f"""ID: regenerate_case
{case_text}
CURRENT CODES: {existing_codes_text or "None"}"""
    
    # Replace the data placeholder
    final_prompt = base_prompt.replace('{{DATA}}', case_data)
    
    return final_prompt

def regenerate_codes(case_id, case_text, existing_codes, user_instructions, all_existing_codes=None):
    """Regenerate codes using Gemini API with user instructions"""
    try:
        logger.info(f"Regenerating codes for case {case_id}")
        logger.info(f"User instructions: {user_instructions}")
        
        # Load system prompt
        system_prompt = load_system_prompt()
        
        # Create regeneration prompt (using the same structure as main analysis)
        user_prompt = create_regeneration_prompt(case_text, existing_codes, user_instructions, all_existing_codes)
        
        # Call Gemini API
        response = get_analysis(system_prompt, user_prompt)
        json_result = response_to_json(response)
        
        # Extract codes from response (try multiple possible keys)
        if "regenerate_case" in json_result:
            new_codes = json_result["regenerate_case"]
        elif "codes" in json_result:
            new_codes = json_result["codes"]
        elif case_id in json_result:
            new_codes = json_result[case_id]
        elif "case_id" in json_result:
            new_codes = json_result["case_id"]
        else:
            # Try to find any array in the response
            for key, value in json_result.items():
                if isinstance(value, list):
                    new_codes = value
                    break
            else:
                raise ValueError("No valid codes found in API response")
        
        # Ensure codes is a list
        if not isinstance(new_codes, list):
            new_codes = [new_codes] if new_codes else []
        
        # Filter out empty codes
        new_codes = [code for code in new_codes if code and str(code).strip()]
        
        if not new_codes:
            raise ValueError("No valid codes generated")
        
        logger.info(f"Successfully generated {len(new_codes)} new codes")
        return new_codes
        
    except Exception as e:
        logger.error(f"Error regenerating codes: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description='Regenerate codes for a case with custom instructions')
    parser.add_argument('--case-id', required=True, help='Case ID')
    parser.add_argument('--case-text', required=True, help='Case text content')
    parser.add_argument('--instructions', required=False, default="", help='User instructions for regeneration (optional)')
    parser.add_argument('--existing-codes', required=False, help='Existing codes as JSON string')
    parser.add_argument('--all-existing-codes', required=False, help='All existing codes for consistency (JSON string)')
    
    args = parser.parse_args()
    
    try:
        # Parse existing codes if provided
        existing_codes = []
        if args.existing_codes:
            try:
                existing_codes = json.loads(args.existing_codes)
            except json.JSONDecodeError:
                logger.warning("Could not parse existing codes, proceeding without them")
        
        # Parse all existing codes if provided
        all_existing_codes = []
        if args.all_existing_codes:
            try:
                all_existing_codes = json.loads(args.all_existing_codes)
            except json.JSONDecodeError:
                logger.warning("Could not parse all existing codes, proceeding without consistency reference")
        
        # Regenerate codes
        new_codes = regenerate_codes(
            args.case_id,
            args.case_text,
            existing_codes,
            args.instructions,
            all_existing_codes
        )
        
        # Output result as JSON
        result = {
            "success": True,
            "case_id": args.case_id,
            "codes": new_codes,
            "instructions": args.instructions,
            "existing_codes": existing_codes
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        # Output error as JSON
        error_result = {
            "success": False,
            "error": str(e),
            "case_id": args.case_id
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main() 