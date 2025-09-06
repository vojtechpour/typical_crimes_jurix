from collections import Counter
import json
import logging
from pathlib import Path
import datetime
import sys
import argparse
from gemini_api import get_analysis as gemini_get_analysis, response_to_json, COMPLETION_LEN, MODEL as GEMINI_MODEL
import os
try:
    from openai import OpenAI  # OpenAI Responses API
except Exception:
    OpenAI = None


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('analysis_p3.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

DATA_DIR = Path('data')
USER_PROMPT_FILE = DATA_DIR / 'phase_3_prompt.txt'
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'
PROMPT_LIMIT = 160000  # Updated to 160,000 tokens
OUTPUT_FIELD = 'candidate_theme'

def log_p3_progress_update(case_id, candidate_theme, initial_codes, progress_info):
    """Log structured progress update for WebSocket broadcasting"""
    progress_data = {
        "type": "p3_progress",
        "case_id": case_id,
        "candidate_theme": candidate_theme,
        "initial_codes": initial_codes if isinstance(initial_codes, list) else [initial_codes],
        "progress": progress_info,
        "timestamp": datetime.datetime.now().isoformat()
    }
    print(f"P3_PROGRESS_UPDATE:{json.dumps(progress_data)}")
    logger.info(f"✅ Generated theme for case {case_id}: '{candidate_theme[:50]}{'...' if len(candidate_theme) > 50 else ''}'")

def log_p3_phase_update(phase, details=None):
    """Log phase update for WebSocket broadcasting"""
    phase_data = {
        "type": "p3_phase",
        "phase": phase,
        "details": details or {},
        "timestamp": datetime.datetime.now().isoformat()
    }
    print(f"P3_PHASE_UPDATE:{json.dumps(phase_data)}")
    logger.info(f"Phase: {phase}")

def count_tokens_estimate(text):
    """Estimate token count for Gemini models (1 token ≈ 4 characters)"""
    return max(1, len(text) // 4)

def count_unique_themes(data):
    """Count unique candidate themes in the dataset"""
    themes = set()
    for case_data in data.values():
        if OUTPUT_FIELD in case_data:
            themes.add(case_data[OUTPUT_FIELD])
    return len(themes)

def construct_user_prompt(candidate_themes):
    logger.info(f"Constructing user prompt with {len(candidate_themes)} existing candidate themes")
    
    # Load the phase-specific prompt template
    with open(USER_PROMPT_FILE, 'r') as f:
        user_prompt = f.read().strip()
    
    # Fill in existing themes for consistency
    if not candidate_themes:
        themes_text = 'This is the first batch. Hence, there are no candidate themes identified yet.'
        logger.info("First batch - no existing candidate themes")
    else:
        # Use top 1000 most common themes (increased from 100)
        top_1000_themes = {t[0] for t in Counter(candidate_themes).most_common(1000)}
        themes_text = '\n'.join(f'- {ct}'.replace('\n', ' ') for ct in top_1000_themes)
        logger.info(f"Using {len(top_1000_themes)} unique existing candidate themes for consistency")
    
    user_prompt = user_prompt.replace('{{CANDIDATE_THEMES}}', themes_text)
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

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Phase 3 Candidate Theme Analysis')
    parser.add_argument('--data-file', type=str, help='Path to the data file to analyze')
    args = parser.parse_args()

    # Determine data file
    if args.data_file:
        if args.data_file.startswith('/'):
            DATA_FILE = Path(args.data_file)
        else:
            # Check if it's in uploads directory
            uploads_path = Path('uploads') / args.data_file
            if uploads_path.exists():
                DATA_FILE = uploads_path
            else:
                DATA_FILE = DATA_DIR / args.data_file
    else:
        DATA_FILE = DATA_DIR / 'kradeze_pripady_test_100_2_balanced_dedupl_claude_multiple_initial_codes.json'

    # Provider/model selection from environment (set by server like P2)
    PROVIDER = os.getenv('MODEL_PROVIDER', 'gemini').lower()
    SELECTED_MODEL = (
        os.getenv('OPENAI_MODEL') if PROVIDER == 'openai' else os.getenv('GEMINI_MODEL', GEMINI_MODEL)
    )

    logger.info("=== Starting Phase 3 Analysis (Candidate Themes) ===")
    logger.info(f"Using provider: {PROVIDER}")
    logger.info(f"Using model: {SELECTED_MODEL}")
    logger.info(f"Token limit: {PROMPT_LIMIT:,}")
    logger.info(f"Data file: {DATA_FILE}")
    logger.info("💾 Saving after each case processed")

    # Check if data file exists
    if not DATA_FILE.exists():
        logger.error(f"❌ Data file not found: {DATA_FILE}")
        sys.exit(1)

    with open(DATA_FILE, 'r', encoding='utf8') as f:
        data = json.load(f)

    total_cases = len(data)
    processed_cases = len([dp for dp in data.values() if OUTPUT_FIELD in dp])
    remaining_cases = total_cases - processed_cases
    unique_themes_count = count_unique_themes(data)

    logger.info(f"Total cases in dataset: {total_cases:,}")
    logger.info(f"Already processed cases: {processed_cases:,}")
    logger.info(f"Remaining cases to process: {remaining_cases:,}")
    logger.info(f"Unique themes so far: {unique_themes_count:,}")

    # Log initial phase update
    log_p3_phase_update("Initializing", {
        "total_cases": total_cases,
        "processed_cases": processed_cases,
        "remaining_cases": remaining_cases,
        "unique_themes": unique_themes_count,
        "data_file": str(DATA_FILE)
    })

    candidate_themes = [dp[OUTPUT_FIELD] for dp in data.values() if OUTPUT_FIELD in dp]
    user_prompt = construct_user_prompt(candidate_themes)
    with open(SYSTEM_PROMPT_FILE, 'r') as f:
        system_prompt = f.read().strip()

    # Estimate token usage
    base_user_tokens = count_tokens_estimate(user_prompt)
    base_system_tokens = count_tokens_estimate(system_prompt)
    prompt_length_base = base_user_tokens + base_system_tokens + COMPLETION_LEN

    logger.info(f"Base prompt tokens (estimated) - User: {base_user_tokens:,}, System: {base_system_tokens:,}, Completion: {COMPLETION_LEN:,}")
    logger.info(f"Total base tokens (estimated): {prompt_length_base:,}")
    logger.info(f"Available tokens for data: {PROMPT_LIMIT - prompt_length_base:,}")

    # Log processing start
    if remaining_cases > 0:
        log_p3_phase_update("Processing", {
            "total_cases": total_cases,
            "processed_cases": processed_cases,
            "unique_themes": unique_themes_count
        })

    logger.info("Starting main processing loop...")
    processed_count = 0
    total_processed_this_run = 0

    for id_slt, data_point in data.items():
        if OUTPUT_FIELD in data_point:
            continue
        
        processed_count += 1
        logger.info(f"Processing case {processed_count}/{remaining_cases}: {id_slt}")
        
        # Construct user prompt for this single case
        user_prompt = construct_user_prompt(candidate_themes)
        
        # Handle multiple initial codes - flatten array to string
        initial_codes = data_point.get('initial_code_0', [])
        if isinstance(initial_codes, list):
            codes_text = ', '.join(initial_codes)
            logger.debug(f"Case {id_slt}: Processing {len(initial_codes)} initial codes")
        else:
            codes_text = str(initial_codes)
            logger.debug(f"Case {id_slt}: Processing single initial code")
        
        # Create data prompt for single case
        case_data_prompt = (
            f'ID: {id_slt}\n'
            f'Initial codes: [{codes_text}]\n'
            f'---\n\n'
        )
        user_prompt_w_data = user_prompt.replace('{{DATA}}', case_data_prompt)
        
        try:
            logger.info(f"Sending case {id_slt} to AI API...")
            
            # Retry logic for API calls
            max_retries = 3
            for attempt in range(max_retries):
                def get_provider_analysis(sys_prompt, usr_prompt):
                    if PROVIDER == 'gemini':
                        return gemini_get_analysis(sys_prompt, usr_prompt)
                    if OpenAI is None:
                        raise RuntimeError("OpenAI client not available")
                    # Load API key
                    with open('config.json') as cf:
                        cfg = json.load(cf)
                        openai_api_key = cfg.get('api_key') or cfg.get('openai_api_key')
                    client = OpenAI(api_key=openai_api_key)
                    model_name = SELECTED_MODEL or 'gpt-5'
                    input_list = [
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": usr_prompt},
                    ]
                    response = client.responses.create(model=model_name, input=input_list)
                    content_text = response.output_text
                    return {
                        'system_prompt': sys_prompt,
                        'user_prompt': usr_prompt,
                        'params': {'model': model_name},
                        'choices': [{'message': {'content': content_text}}],
                    }

                response = get_provider_analysis(system_prompt, user_prompt_w_data)
                json_res = response_to_json(response)
                
                if id_slt in json_res:
                    candidate_theme = json_res[id_slt]
                    data[id_slt][OUTPUT_FIELD] = candidate_theme
                    candidate_themes.append(candidate_theme)
                    
                    # Save immediately after each case
                    if save_data_safely(data, DATA_FILE):
                        total_processed_this_run += 1
                        current_processed = processed_cases + total_processed_this_run
                        current_unique_themes = count_unique_themes(data)
                        
                        # Log progress update for WebSocket
                        log_p3_progress_update(
                            case_id=id_slt,
                            candidate_theme=candidate_theme,
                            initial_codes=initial_codes,
                            progress_info={
                                "processed": current_processed,
                                "total": total_cases,
                                "unique_themes": current_unique_themes,
                                "percentage": round((current_processed / total_cases) * 100, 1)
                            }
                        )
                        
                        logger.info(f"Progress: {current_processed}/{total_cases} ({((current_processed)/total_cases*100):.1f}%)")
                    else:
                        logger.error(f"❌ Failed to save case {id_slt}")
                    
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

    final_processed = processed_cases + total_processed_this_run
    final_unique_themes = count_unique_themes(data)

    # Log completion
    log_p3_phase_update("Complete", {
        "total_cases": total_cases,
        "processed_cases": final_processed,
        "unique_themes": final_unique_themes,
        "new_cases_this_run": total_processed_this_run
    })

    logger.info("=== Phase 3 Analysis Complete ===")
    logger.info(f"Total cases processed: {total_processed_this_run}")
    logger.info(f"Final progress: {final_processed}/{total_cases} ({((final_processed)/total_cases*100):.1f}%)")
    logger.info(f"Final unique themes: {final_unique_themes}")
    logger.info("💾 All cases saved individually as processed")
    logger.info("Log saved to: analysis_p3.log")

if __name__ == "__main__":
    main()