#!/usr/bin/env python3
"""
Add More Codes Script
Adds additional initial codes for a specific case to complement existing codes
"""

import argparse
import json
import sys
import logging
import os
from pathlib import Path
from gemini_api import get_analysis, response_to_json
try:
    from openai import OpenAI  # OpenAI Responses API
except Exception:
    OpenAI = None

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

def create_add_codes_prompt(case_text, existing_codes, user_instructions, all_existing_codes=None):
    """Create a prompt specifically for ADDING codes to complement existing ones"""
    
    # Load the Phase 2 prompt template as a base
    try:
        phase_2_prompt_file = DATA_DIR / 'phase_2_prompt.txt'
        with open(phase_2_prompt_file, 'r') as f:
            base_prompt = f.read().strip()
    except FileNotFoundError:
        logger.error(f"Phase 2 prompt file not found: {phase_2_prompt_file}")
        # Fallback to basic prompt
        base_prompt = """THEMATIC ANALYSIS - PHASE 2: ADDING ADDITIONAL CODES
Generate additional codes to complement existing codes for this case.
Use structured underscore format (e.g., "shoplifting_alcohol", "theft_of_bicycle").
Output as JSON with case IDs as keys and arrays of codes as values.

EXISTING CODES FROM PREVIOUS ANALYSIS
{{INITIAL_CODES}}

CRIME CASE TO ANALYZE
{{DATA}}"""

    # Modify the title and instructions for ADD mode
    base_prompt = base_prompt.replace(
        "THEMATIC ANALYSIS - PHASE 2: GENERATING INITIAL CODES",
        "THEMATIC ANALYSIS - PHASE 2: ADDING COMPLEMENTARY CODES"
    )
    
    # Add specific ADD MODE instructions at the top
    add_mode_instructions = """
🔴 ADD MODE: GENERATING COMPLEMENTARY CODES 🔴

CRITICAL INSTRUCTIONS FOR THIS TASK:
- This case ALREADY HAS existing codes (shown below)
- Your task is to generate ADDITIONAL codes that COMPLEMENT the existing ones
- DO NOT regenerate, replace, or duplicate the existing codes
- Focus on aspects of the case that are NOT YET captured by the existing codes
- Look for additional facets: victim characteristics, environmental factors, temporal aspects, security measures, etc.
- Generate 2-4 new codes that add analytical value
- If the existing codes already comprehensively cover the case, you may generate 1-2 codes for minor additional aspects

"""
    
    base_prompt = add_mode_instructions + base_prompt
    
    # Prepare existing codes section for consistency reference
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
    
    # Add user instructions if provided
    if user_instructions and user_instructions.strip():
        instructions_section = f"""

ADDITIONAL USER INSTRUCTIONS FOR NEW CODES:
{user_instructions.strip()}

Please generate additional codes based on these instructions while avoiding duplication of the existing codes shown below.
"""
        # Insert instructions before the data section
        base_prompt = base_prompt.replace('{{DATA}}', instructions_section + '\n\n{{DATA}}')
        logger.info(f"Added user instructions to add codes prompt")
    
    # Create the data section showing EXISTING codes prominently
    existing_codes_text = ""
    if existing_codes:
        if isinstance(existing_codes, list):
            existing_codes_text = '\n'.join(f'  - {code}' for code in existing_codes)
        else:
            existing_codes_text = f'  - {existing_codes}'
    
    case_data = f"""ID: add_codes_case

📋 EXISTING CODES FOR THIS CASE (DO NOT DUPLICATE):
{existing_codes_text or "  (none)"}

📄 CASE TEXT:
{case_text}

TASK: Generate 2-4 ADDITIONAL codes that capture aspects NOT covered by the existing codes above."""
    
    # Replace the data placeholder
    final_prompt = base_prompt.replace('{{DATA}}', case_data)
    
    # Modify the output requirements section
    final_prompt = final_prompt.replace(
        "Create an ARRAY of 3-5 initial codes per case",
        "Create an ARRAY of 2-4 ADDITIONAL codes (codes that are NOT already present in the existing codes)"
    )
    
    return final_prompt

def _openai_get_analysis(system_prompt: str, user_prompt: str, model_name: str):
    """Call OpenAI Responses API and return a compatibility dict like gemini_api.get_analysis"""
    if OpenAI is None:
        raise RuntimeError("OpenAI client not available")
    with open('config.json') as f:
        cfg = json.load(f)
        openai_api_key = cfg.get('api_key') or cfg.get('openai_api_key')
    client = OpenAI(api_key=openai_api_key)
    input_list = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    response = client.responses.create(model=model_name, input=input_list)
    content_text = response.output_text
    return {
        'system_prompt': system_prompt,
        'user_prompt': user_prompt,
        'params': {'model': model_name},
        'choices': [{'message': {'content': content_text}}],
    }

def _anthropic_get_analysis(system_prompt: str, user_prompt: str, model_name: str):
    """Call Anthropic API and return a compatibility dict"""
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("anthropic package not available")
    
    with open('config.json') as f:
        cfg = json.load(f)
        anthropic_api_key = cfg.get('anthropic_api_key')
    
    client = anthropic.Anthropic(api_key=anthropic_api_key)
    response = client.messages.create(
        model=model_name,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    )
    
    content_text = response.content[0].text
    return {
        'system_prompt': system_prompt,
        'user_prompt': user_prompt,
        'params': {'model': model_name},
        'choices': [{'message': {'content': content_text}}],
    }

def add_codes(case_id, case_text, existing_codes, user_instructions, all_existing_codes=None):
    """Add complementary codes using selected provider/model with user instructions"""
    try:
        logger.info(f"Adding codes for case {case_id}")
        logger.info(f"Existing codes count: {len(existing_codes) if isinstance(existing_codes, list) else 1}")
        logger.info(f"User instructions: {user_instructions}")
        
        # Load system prompt
        system_prompt = load_system_prompt()
        
        # Create add codes prompt (with special ADD mode instructions)
        user_prompt = create_add_codes_prompt(case_text, existing_codes, user_instructions, all_existing_codes)
        
        # Determine provider/model from environment (set by server)
        provider = os.getenv('MODEL_PROVIDER', 'gemini').lower()
        
        # Call the appropriate provider
        if provider == 'openai':
            selected_model = os.getenv('OPENAI_MODEL', 'gpt-4o')
            logger.info(f"Using OpenAI model: {selected_model}")
            response = _openai_get_analysis(system_prompt, user_prompt, selected_model)
        elif provider == 'claude':
            selected_model = os.getenv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022')
            logger.info(f"Using Claude model: {selected_model}")
            response = _anthropic_get_analysis(system_prompt, user_prompt, selected_model)
        else:
            selected_model = os.getenv('GEMINI_MODEL', MODEL)
            logger.info(f"Using Gemini model: {selected_model}")
            response = get_analysis(system_prompt, user_prompt)
        
        json_result = response_to_json(response)
        
        # Extract codes from response (try multiple possible keys)
        if "add_codes_case" in json_result:
            new_codes = json_result["add_codes_case"]
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
        
        # Filter out any codes that duplicate existing codes
        existing_codes_set = set()
        if existing_codes:
            if isinstance(existing_codes, list):
                existing_codes_set = set(str(code).lower() for code in existing_codes)
            else:
                existing_codes_set.add(str(existing_codes).lower())
        
        # Only keep truly new codes
        truly_new_codes = [code for code in new_codes if str(code).lower() not in existing_codes_set]
        
        if not truly_new_codes:
            logger.warning("No new codes generated (all were duplicates or empty)")
            # Still return empty list as success, just with count 0
            truly_new_codes = []
        
        logger.info(f"Successfully generated {len(truly_new_codes)} new codes (filtered out {len(new_codes) - len(truly_new_codes)} duplicates)")
        return truly_new_codes
        
    except Exception as e:
        logger.error(f"Error adding codes: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description='Add complementary codes for a case')
    parser.add_argument('--case-id', required=True, help='Case ID')
    parser.add_argument('--case-text', required=True, help='Case text content')
    parser.add_argument('--instructions', required=False, default="", help='User instructions for what to add (optional)')
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
        
        # Add codes
        new_codes = add_codes(
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

