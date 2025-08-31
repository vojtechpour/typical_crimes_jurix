from collections import Counter
import json
import logging
from pathlib import Path
import datetime
import anthropic
import time


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('analysis_p2_claude.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

DATA_DIR = Path('data')
USER_PROMPT_FILE = DATA_DIR / 'phase_2_prompt.txt'
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'
PROMPT_LIMIT = 100000  # Claude has higher token limits
OUTPUT_FIELD = 'initial_code_0'
DATA_FILE = DATA_DIR / 'kradeze_pripady_test_100_2_balanced_dedupl_claude_multiple_initial_codes.json'
MODEL = 'claude-sonnet-4-20250514'  # Claude Sonnet 4
COMPLETION_LEN = 2000

# Load API key from config
with open('config.json') as f:
    config = json.load(f)
    api_key = config.get('anthropic_api_key')
    if not api_key:
        raise ValueError("anthropic_api_key not found in config.json")

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=api_key)


def count_tokens_estimate(text):
    """Estimate token count (Claude doesn't have a separate token counting API)"""
    # Rough estimation: 1 token ≈ 4 characters for Claude
    return max(1, len(text) // 4)


def get_analysis(system_prompt, user_prompt):
    logger.info(f"Sending request to Claude API at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=COMPLETION_LEN,
            temperature=1.0,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        
        # Create compatibility response format
        response_dict = {
            'system_prompt': system_prompt,
            'user_prompt': user_prompt,
            'params': {
                'temperature': 1.0,
                'max_tokens': COMPLETION_LEN,
            },
            'choices': [{
                'message': {
                    'content': response.content[0].text
                }
            }],
            'usage': response.usage.__dict__
        }
        return response_dict
        
    except Exception as e:
        error_str = str(e).lower()
        if "rate limit" in error_str or "quota" in error_str:
            logger.warning('Rate limit error, sleeping for 1 minute ...')
            time.sleep(60)
            return get_analysis(system_prompt, user_prompt)
        else:
            raise e


def response_to_json(response):
    logger.info(f"Response received from Claude API at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Handle compatibility format response
    plain_text = response['choices'][0]['message']['content'].strip()
    
    logger.debug(f"Raw response content: {plain_text[:100]}...")
    
    # Handle markdown code blocks
    if plain_text.startswith("```json") and "```" in plain_text[6:]:
        plain_text = plain_text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif plain_text.startswith("```") and "```" in plain_text[3:]:
        plain_text = plain_text.split("```", 1)[1].split("```", 1)[0].strip()
    
    # Add error handling for JSON parsing
    try:
        return json.loads(plain_text)
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON: {e}")
        logger.error(f"Full response content: {plain_text}")
        return {}


def construct_user_prompt(initial_codes):
    logger.info(f"Constructing user prompt with codes from {len(initial_codes)} cases")
    
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
        for code_entry in initial_codes:
            if isinstance(code_entry, list):
                flattened_codes.extend([str(c) for c in code_entry])
            elif isinstance(code_entry, str):
                flattened_codes.append(str(code_entry))
            else:
                # Handle any other format by converting to string
                flattened_codes.append(str(code_entry))
        
        # Use all unique codes for consistency
        unique_codes = set(flattened_codes)
        codes_text = '\n'.join(f'- {code}'.replace('\n', ' ') for code in sorted(unique_codes))
        logger.info(f"Using {len(unique_codes)} unique existing codes for consistency")
    
    user_prompt = user_prompt.replace('{{INITIAL_CODES}}', codes_text)
    
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


logger.info("=== Starting Phase 2 Analysis with Claude ===")
logger.info(f"Using model: {MODEL}")
logger.info(f"Token limit: {PROMPT_LIMIT:,}")
logger.info("💾 Saving after each case processed")

with open(DATA_FILE, 'r', encoding='utf8') as f:
    data = json.load(f)

total_cases = len(data)
processed_cases = len([dp for dp in data.values() if OUTPUT_FIELD in dp])
remaining_cases = total_cases - processed_cases

logger.info(f"Total cases in dataset: {total_cases:,}")
logger.info(f"Already processed cases: {processed_cases:,}")
logger.info(f"Remaining cases to process: {remaining_cases:,}")

candidate_codes = [dp[OUTPUT_FIELD] for dp in data.values() if OUTPUT_FIELD in dp]
user_prompt = construct_user_prompt(candidate_codes)
with open(SYSTEM_PROMPT_FILE, 'r') as f:
    system_prompt = f.read().strip()

# Estimate token usage
base_user_tokens = count_tokens_estimate(user_prompt)
base_system_tokens = count_tokens_estimate(system_prompt)
prompt_length_base = base_user_tokens + base_system_tokens + COMPLETION_LEN

logger.info(f"Base prompt tokens (estimated) - User: {base_user_tokens:,}, System: {base_system_tokens:,}, Completion: {COMPLETION_LEN:,}")
logger.info(f"Total base tokens (estimated): {prompt_length_base:,}")
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
    user_prompt = construct_user_prompt(candidate_codes)
    
    # Create data prompt for single case
    case_data_prompt = (
        f'ID: {id_slt}\n'
        f'{data_point["plny_skutek_short"]}\n'
        f'---\n\n'
    )
    user_prompt_w_data = user_prompt.replace('{{DATA}}', case_data_prompt)
    
    try:
        logger.info(f"Sending case {id_slt} to Claude API...")
        
        # Retry logic for API calls
        max_retries = 3
        for attempt in range(max_retries):
            response = get_analysis(system_prompt, user_prompt_w_data)
            json_res = response_to_json(response)
            
            if id_slt in json_res:
                init_codes = json_res[id_slt]
                # Ensure init_codes is a list
                if not isinstance(init_codes, list):
                    init_codes = [init_codes]
                
                data[id_slt][OUTPUT_FIELD] = init_codes
                candidate_codes.append(init_codes)
                
                # Save immediately after each case
                if save_data_safely(data, DATA_FILE):
                    codes_preview = ', '.join(init_codes[:3]) + ('...' if len(init_codes) > 3 else '')
                    logger.info(f"✅ Case {id_slt} processed and saved: [{codes_preview}] ({len(init_codes)} codes)")
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
        logger.error(f"❌ Error processing case {id_slt}: {e}")
        # Continue with next case instead of crashing

logger.info(f"Finished processing loop. Processed {total_processed_this_run} new cases.")

logger.info("=== Phase 2 Analysis Complete ===")
logger.info(f"Total cases processed: {total_processed_this_run}")
logger.info(f"Final progress: {processed_cases + total_processed_this_run}/{total_cases} ({((processed_cases + total_processed_this_run)/total_cases*100):.1f}%)")
logger.info("💾 All cases saved individually as processed")
logger.info("Log saved to: analysis_p2_claude.log") 