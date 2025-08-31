#!/usr/bin/env python3
"""
Bulk Code Regeneration Script
Regenerates initial codes for multiple cases using custom user instructions
"""

import argparse
import json
import sys
import logging
import time
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

def create_bulk_regeneration_prompt(cases_data, user_instructions, existing_codes=None):
    """Create a prompt for bulk regeneration using the same structure as main analysis"""
    
    # Load the Phase 2 prompt template (same as main analysis)
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
    if existing_codes:
        # Get unique codes from all existing data
        all_codes = set()
        for codes in existing_codes:
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
        logger.info(f"Added user instructions to bulk regeneration prompt")
    
    # Create the data section for the specific cases
    cases_text = ""
    for case in cases_data:
        existing_codes_text = ""
        if case['existingCodes']:
            if isinstance(case['existingCodes'], list):
                existing_codes_text = ', '.join(f'"{code}"' for code in case['existingCodes'])
            else:
                existing_codes_text = f'"{case["existingCodes"]}"'
        
        cases_text += f"""
ID: {case['caseId']}
{case['caseText']}
CURRENT CODES: {existing_codes_text or "None"}
---

"""
    
    # Replace the data placeholder
    final_prompt = base_prompt.replace('{{DATA}}', cases_text.strip())
    
    return final_prompt

def log_bulk_progress_update(current, total, status, case_id=None):
    """Log structured progress update for the web interface"""
    progress_data = {
        "type": "bulk_progress",
        "current": current,
        "total": total,
        "status": status,
        "case_id": case_id,
        "percentage": (current / max(total, 1)) * 100,
        "timestamp": time.time()
    }
    # Output as structured log for the web interface to parse
    print(f"BULK_PROGRESS_UPDATE:{json.dumps(progress_data)}", flush=True)

def regenerate_codes_bulk(cases_data, user_instructions, existing_codes=None):
    """Regenerate codes for multiple cases using Gemini API"""
    try:
        total_cases = len(cases_data)
        logger.info(f"Bulk regenerating codes for {total_cases} cases")
        logger.info(f"User instructions: {user_instructions}")
        
        # Initial progress update
        log_bulk_progress_update(0, total_cases, "Initializing bulk regeneration...")
        
        # Load system prompt
        system_prompt = load_system_prompt()
        
        # Gather all existing codes for consistency (same approach as main analysis)
        all_existing_codes = []
        if existing_codes:
            all_existing_codes = existing_codes
        
        # Process in batches to avoid token limits
        batch_size = 5  # Reduced batch size for better progress tracking
        all_updated_codes = {}
        processed_count = 0
        
        for i in range(0, len(cases_data), batch_size):
            batch = cases_data[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(cases_data) + batch_size - 1) // batch_size
            
            log_bulk_progress_update(
                processed_count, 
                total_cases, 
                f"Processing batch {batch_num}/{total_batches} ({len(batch)} cases)..."
            )
            
            logger.info(f"Processing batch {batch_num}/{total_batches}: cases {i+1}-{min(i+batch_size, len(cases_data))}")
            
            # Create regeneration prompt for this batch (using the same structure as main analysis)
            user_prompt = create_bulk_regeneration_prompt(batch, user_instructions, all_existing_codes)
            
            # Update progress for API call
            log_bulk_progress_update(
                processed_count, 
                total_cases, 
                f"Calling AI API for batch {batch_num}..."
            )
            
            # Call Gemini API
            response = get_analysis(system_prompt, user_prompt)
            json_result = response_to_json(response)
            
            # Extract codes from response
            batch_updated_codes = {}
            
            # Process each case in the batch
            for case_index, case in enumerate(batch):
                case_id = case['caseId']
                
                # Update progress for individual case
                log_bulk_progress_update(
                    processed_count + case_index, 
                    total_cases, 
                    f"Processing case {case_id}...",
                    case_id
                )
                
                if case_id in json_result:
                    new_codes = json_result[case_id]
                else:
                    # Try to find codes by looking for patterns
                    for key, value in json_result.items():
                        if case_id in str(key) and isinstance(value, list):
                            new_codes = value
                            break
                    else:
                        logger.warning(f"No codes found for case {case_id}, keeping existing codes")
                        new_codes = case['existingCodes']
                
                # Ensure codes is a list
                if not isinstance(new_codes, list):
                    new_codes = [new_codes] if new_codes else []
                
                # Filter out empty codes
                new_codes = [code for code in new_codes if code and str(code).strip()]
                
                if not new_codes:
                    logger.warning(f"No valid codes generated for case {case_id}, keeping existing")
                    new_codes = case['existingCodes'] if isinstance(case['existingCodes'], list) else [case['existingCodes']]
                
                batch_updated_codes[case_id] = new_codes
                
                # Log completion of individual case
                logger.info(f"Case {case_id} completed: {len(new_codes)} codes generated")
            
            all_updated_codes.update(batch_updated_codes)
            processed_count += len(batch)
            
            # Update progress after batch completion
            log_bulk_progress_update(
                processed_count, 
                total_cases, 
                f"Batch {batch_num} completed ({processed_count}/{total_cases} cases done)"
            )
            
            logger.info(f"Batch {batch_num} completed: {len(batch_updated_codes)} cases processed")
        
        # Final progress update
        log_bulk_progress_update(
            total_cases, 
            total_cases, 
            f"Bulk regeneration completed! Updated {len(all_updated_codes)} cases."
        )
        
        logger.info(f"Successfully regenerated codes for {len(all_updated_codes)} cases")
        return all_updated_codes
        
    except Exception as e:
        log_bulk_progress_update(0, len(cases_data), f"Error: {str(e)}")
        logger.error(f"Error in bulk regeneration: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description='Bulk regenerate codes for multiple cases')
    parser.add_argument('--filename', required=True, help='Filename being processed')
    parser.add_argument('--instructions', required=True, help='User instructions for regeneration')
    parser.add_argument('--cases-data', required=True, help='JSON string with cases data')
    parser.add_argument('--all-existing-codes', help='JSON string with all existing codes for consistency')
    
    args = parser.parse_args()
    
    try:
        # Parse cases data
        cases_data = json.loads(args.cases_data)
        
        # Parse all existing codes if provided
        all_existing_codes = []
        if args.all_existing_codes:
            try:
                all_existing_codes = json.loads(args.all_existing_codes)
            except json.JSONDecodeError:
                logger.warning("Failed to parse all-existing-codes, proceeding without consistency reference")
        
        # Regenerate codes
        updated_codes = regenerate_codes_bulk(cases_data, args.instructions, all_existing_codes)
        
        # Output result as JSON
        result = {
            "success": True,
            "filename": args.filename,
            "updated_codes": updated_codes,
            "updated_cases": len(updated_codes),
            "instructions": args.instructions
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        # Output error as JSON
        error_result = {
            "success": False,
            "error": str(e),
            "filename": args.filename
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main() 