from collections import Counter
import json
import logging
from pathlib import Path
import sys
import os
import time
from gemini_api import get_analysis as gemini_get_analysis, response_to_json, COMPLETION_LEN, count_tokens, MODEL as GEMINI_MODEL
import datetime
import argparse
try:
    from openai import OpenAI  # OpenAI Responses API
except Exception:
    OpenAI = None


def log_progress_update(case_id, codes, progress_info):
    """Log structured progress update for the web interface"""
    progress_data = {
        "type": "case_completed",
        "case_id": case_id,
        "codes": codes,
        "progress": progress_info,
        "timestamp": datetime.datetime.now().isoformat()
    }
    # Output as JSON for the web interface to parse
    print(f"PROGRESS_UPDATE:{json.dumps(progress_data)}")
    
def log_phase_update(phase, details=None):
    """Log phase change for the web interface"""
    phase_data = {
        "type": "phase_change",
        "phase": phase,
        "details": details or {},
        "timestamp": datetime.datetime.now().isoformat()
    }
    print(f"PHASE_UPDATE:{json.dumps(phase_data)}")


# Set up logging to send INFO messages to stdout instead of stderr
class InfoFilter(logging.Filter):
    def filter(self, record):
        return record.levelno < logging.WARNING

class WarningFilter(logging.Filter):
    def filter(self, record):
        return record.levelno >= logging.WARNING

# Create handlers
stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setLevel(logging.INFO)
stdout_handler.addFilter(InfoFilter())

stderr_handler = logging.StreamHandler(sys.stderr)
stderr_handler.setLevel(logging.WARNING)
stderr_handler.addFilter(WarningFilter())

file_handler = logging.FileHandler('analysis_p2.log')
file_handler.setLevel(logging.INFO)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        stdout_handler,
        stderr_handler,
        file_handler
    ]
)
logger = logging.getLogger(__name__)

DATA_DIR = Path('data')
USER_PROMPT_FILE = DATA_DIR / 'phase_2_prompt.txt'
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'
PROMPT_LIMIT = 40000  # Updated to 40,000 tokens
OUTPUT_FIELD = 'initial_code_0'

# Parse command line arguments
parser = argparse.ArgumentParser(description='Run Phase 2 thematic analysis')
parser.add_argument('datafile', nargs='?', help='Data file to analyze (optional)')
parser.add_argument('--global-instructions', help='Global instructions for code generation (optional)')
args = parser.parse_args()

# Accept filename as command line argument
if args.datafile:
    # Use provided filename (could be in uploads directory)
    if args.datafile.startswith('uploaded_'):
        DATA_FILE = Path('uploads') / args.datafile
    else:
        DATA_FILE = DATA_DIR / args.datafile
else:
    # Default fallback
    DATA_FILE = DATA_DIR / 'kradeze_pripady_test_100_2_balanced_dedupl.json'

# Provider/model selection from environment (set by server)
PROVIDER = os.getenv('MODEL_PROVIDER', 'gemini').lower()
SELECTED_MODEL = (
    os.getenv('OPENAI_MODEL') if PROVIDER == 'openai' else os.getenv('GEMINI_MODEL', GEMINI_MODEL)
)

logger.info(f"Using data file: {DATA_FILE}")


# ---
ANALYSIS_DEFINITION_FILE = DATA_DIR / 'crimes_analysis_definition.json'
PHASES_DEFINITION_FILE = DATA_DIR / 'phases_definition.json'
PHASE_NUM = '2'
PHASE_SPECS = '''Perform phase 2 of the thematic analysis, i.e., generate initial codes. 

Below, you are provided with all already generated initial codes from the previous batches of analyzed data points. When defining the codes try to be consistent so that similar data points are coded consistently. On the other hand, try to be as specific as possible, i.e., do not use too general codes.

ALREADY IDENTIFIED INITIAL CODES
{{INITIAL_CODES}}
'''
EXPECTED_OUTPUT_FILE = DATA_DIR / 'phase_2_output.txt'
# ---


def construct_user_prompt(initial_codes, global_instructions=None):
    logger.info(f"Constructing user prompt with {len(initial_codes)} existing codes")
    
    # Load the phase-specific prompt template
    with open(USER_PROMPT_FILE, 'r') as f:
        user_prompt = f.read().strip()
    
    # Fill in existing codes for consistency
    if not initial_codes:
        codes_text = 'This is the first batch. No initial codes have been assigned yet.'
        logger.info("First batch - no existing codes")
    else:
        # Flatten any lists and ensure all codes are strings
        flattened_codes = []
        for code in initial_codes:
            if isinstance(code, list):
                flattened_codes.extend([str(c) for c in code])
            else:
                flattened_codes.append(str(code))
        
        # Use all unique codes for consistency
        unique_codes = set(flattened_codes)
        codes_text = '\n'.join(f'- {code}'.replace('\n', ' ') for code in sorted(unique_codes))
        logger.info(f"Using {len(unique_codes)} unique existing codes for consistency")
    
    user_prompt = user_prompt.replace('{{INITIAL_CODES}}', codes_text)
    
    # Add global instructions if provided
    if global_instructions and global_instructions.strip():
        instructions_section = f"""

SPECIAL INSTRUCTIONS FOR CODE GENERATION:
{global_instructions.strip()}

Please prioritize these instructions while maintaining accuracy and consistency with existing codes.
"""
        # Insert instructions before the data section
        if '{{DATA}}' in user_prompt:
            user_prompt = user_prompt.replace('{{DATA}}', instructions_section + '\n\n{{DATA}}')
        else:
            user_prompt += instructions_section
        logger.info(f"Added global instructions: {global_instructions.strip()}")
    else:
        logger.info("No global instructions provided - using standard prompting")
    
    logger.info("User prompt constructed successfully")
    return user_prompt


def save_data_safely(data, filepath):
    """Save data with error handling"""
    try:
        with open(filepath, 'w', encoding='utf8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.debug("💾 Data saved successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Error saving data: {e}")
        return False


logger.info("=== Starting Phase 2 Analysis ===")
logger.info(f"Using provider: {PROVIDER}")
logger.info(f"Using model: {SELECTED_MODEL}")
logger.info(f"Token limit: {PROMPT_LIMIT:,}")
logger.info(
    "🔄 Using Gemini token counting" if PROVIDER == 'gemini' else "🔄 Using estimated token counting"
)
logger.info("💾 Saving after each case processed")

# Log phase update for web interface
log_phase_update("Initializing", {
    "model": SELECTED_MODEL,
    "token_limit": PROMPT_LIMIT,
    "data_file": str(DATA_FILE)
})

with open(DATA_FILE, 'r', encoding='utf8') as f:
    data = json.load(f)

total_cases = len(data)
processed_cases = len([dp for dp in data.values() if OUTPUT_FIELD in dp])
remaining_cases = total_cases - processed_cases

logger.info(f"Total cases in dataset: {total_cases:,}")
logger.info(f"Already processed cases: {processed_cases:,}")
logger.info(f"Remaining cases to process: {remaining_cases:,}")

# Log initialization details
log_phase_update("Processing Cases", {
    "total_cases": total_cases,
    "processed_cases": processed_cases,
    "remaining_cases": remaining_cases,
    "data_file": str(DATA_FILE)
})

candidate_codes = [dp[OUTPUT_FIELD] for dp in data.values() if OUTPUT_FIELD in dp]

# Convert all codes to strings to prevent unhashable type errors
flattened_candidate_codes = []
for code in candidate_codes:
    if isinstance(code, list):
        flattened_candidate_codes.extend([str(c) for c in code])
    else:
        flattened_candidate_codes.append(str(code))

candidate_codes = flattened_candidate_codes

user_prompt = construct_user_prompt(candidate_codes, args.global_instructions)
with open(SYSTEM_PROMPT_FILE, 'r') as f:
    system_prompt = f.read().strip()

# Token counting (precise for Gemini, estimated for OpenAI)
def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)

if PROVIDER == 'gemini':
    base_user_tokens = count_tokens(user_prompt)
    base_system_tokens = count_tokens(system_prompt)
else:
    base_user_tokens = estimate_tokens(user_prompt)
    base_system_tokens = estimate_tokens(system_prompt)
prompt_length_base = base_user_tokens + base_system_tokens + COMPLETION_LEN

logger.info(f"Base prompt tokens - User: {base_user_tokens:,}, System: {base_system_tokens:,}, Completion: {COMPLETION_LEN:,}")
logger.info(f"Total base tokens: {prompt_length_base:,}")
logger.info(f"Available tokens for data: {PROMPT_LIMIT - prompt_length_base:,}")

logger.info("Starting main processing loop...")
processed_count = 0
total_processed_this_run = 0

for id_slt, data_point in data.items():
    if OUTPUT_FIELD in data_point:
        continue
    
    processed_count += 1
    logger.info(f"Processing case {processed_count}/{remaining_cases}: {id_slt}")
    
    # Construct user prompt for this single case
    user_prompt = construct_user_prompt(candidate_codes, args.global_instructions)
    
    # Create data prompt for single case
    # Prefer short text; fallback to full if short missing
    case_text = data_point.get("plny_skutek_short") or data_point.get("plny_skutek") or ""
    case_data_prompt = (
        f'ID: {id_slt}\n'
        f'{case_text}\n'
        f'---\n\n'
    )
    user_prompt_w_data = user_prompt.replace('{{DATA}}', case_data_prompt)
    
    try:
        logger.info(f"Sending case {id_slt} to {PROVIDER.capitalize()} API...")
        
        # Retry logic for API calls
        max_retries = 3
        for attempt in range(max_retries):
            # Provider-aware analysis call returning compatibility dict
            def get_provider_analysis(sys_prompt, usr_prompt):
                if PROVIDER == 'gemini':
                    return gemini_get_analysis(sys_prompt, usr_prompt)
                # OpenAI (GPT-5) path
                if OpenAI is None:
                    raise RuntimeError("OpenAI client not available")
                # Load API key
                with open('config.json') as cf:
                    cfg = json.load(cf)
                    openai_api_key = cfg.get('api_key') or cfg.get('openai_api_key')
                client = OpenAI(api_key=openai_api_key)
                model_name = SELECTED_MODEL or 'gpt-5'
                # Build input list for Responses API
                input_list = [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": usr_prompt},
                ]
                try:
                    resp = client.responses.create(model=model_name, input=input_list)
                    content_text = resp.output_text
                except Exception as e:
                    # simple retry on rate limit
                    err = str(e).lower()
                    if "rate limit" in err or "quota" in err:
                        time.sleep(60)
                        resp = client.responses.create(model=model_name, input=input_list)
                        content_text = resp.output_text
                    else:
                        raise
                return {
                    'system_prompt': sys_prompt,
                    'user_prompt': usr_prompt,
                    'params': {
                        'model': model_name,
                    },
                    'choices': [{
                        'message': {
                            'content': content_text
                        }
                    }]
                }

            response = get_provider_analysis(system_prompt, user_prompt_w_data)
            json_res = response_to_json(response)
            
            if id_slt in json_res:
                init_code = json_res[id_slt]
                data[id_slt][OUTPUT_FIELD] = init_code
                
                # Handle the case where init_code might be a list
                if isinstance(init_code, list):
                    # Flatten the list and add each code as a string
                    for code in init_code:
                        candidate_codes.append(str(code))
                else:
                    # Add single code as string
                    candidate_codes.append(str(init_code))
                
                # Save immediately after each case
                if save_data_safely(data, DATA_FILE):
                    logger.info(f"✅ Case {id_slt} processed and saved: '{init_code[:50] if isinstance(init_code, str) else str(init_code)[:50]}{'...' if len(str(init_code)) > 50 else ''}'")
                    
                    # Log structured progress update for web interface
                    log_progress_update(id_slt, init_code, {
                        "processed": processed_cases + total_processed_this_run + 1,
                        "total": total_cases,
                        "percentage": ((processed_cases + total_processed_this_run + 1) / total_cases) * 100,
                        "unique_codes": len(set(str(code) for code in candidate_codes)),
                        "case_text": data_point.get("plny_skutek_short", "")
                    })
                else:
                    logger.error(f"❌ Failed to save case {id_slt}")
                
                total_processed_this_run += 1
                logger.info(f"Progress: {processed_cases + total_processed_this_run}/{total_cases} ({((processed_cases + total_processed_this_run)/total_cases*100):.1f}%)")
                break  # Success, exit retry loop
            else:
                logger.warning(f'Attempt {attempt + 1}/{max_retries}: Case {id_slt} not found in API response')
                if attempt < max_retries - 1:
                    logger.info(f"Retrying case {id_slt}...")
                else:
                    logger.error(f"❌ Failed to process case {id_slt} after {max_retries} attempts")
            
    except Exception as e:
        error_msg = str(e)
        if "safety filters" in error_msg.lower():
            logger.error(f"❌ Case {id_slt} blocked by safety filters - skipping")
        else:
            logger.error(f"❌ Error processing case {id_slt}: {e}")
            # Continue with next case instead of crashing

logger.info(f"Finished processing loop. Processed {total_processed_this_run} new cases.")

# Log completion phase
log_phase_update("Complete", {
    "total_processed_this_run": total_processed_this_run,
    "final_processed": processed_cases + total_processed_this_run,
    "final_percentage": ((processed_cases + total_processed_this_run) / total_cases) * 100,
    "unique_codes": len(set(str(code) for code in candidate_codes))
})

logger.info("=== Phase 2 Analysis Complete ===")
logger.info(f"Total cases processed: {total_processed_this_run}")
logger.info(f"Final progress: {processed_cases + total_processed_this_run}/{total_cases} ({((processed_cases + total_processed_this_run)/total_cases*100):.1f}%)")
logger.info("💾 All cases saved individually as processed")
logger.info("Log saved to: analysis_p2.log")
