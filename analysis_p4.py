from collections import Counter
import json
from pathlib import Path
import sys
import argparse
import logging
import datetime
import os
import time
from gemini_api import get_analysis as gemini_get_analysis, response_to_json, COMPLETION_LEN
try:
    from openai import OpenAI  # OpenAI Responses API
except Exception:
    OpenAI = None
try:
    import anthropic  # Anthropic Claude API
except Exception:
    anthropic = None


DATA_DIR = Path('data')
USER_PROMPT_FILE = DATA_DIR / 'user_prompt.txt'
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'
PROMPT_LIMIT = 160000
OUTPUT_FIELD = 'theme'


# ---
ANALYSIS_DEFINITION_FILE = DATA_DIR / 'crimes_analysis_definition.json'
THEMES_FILE_DEFAULT = DATA_DIR / 'kradeze_pripady_3b.json'
PHASES_DEFINITION_FILE = DATA_DIR / 'phases_definition.json'
PHASE_NUM = '4'
PHASE_SPECS = '''Perform phase 4 of the thematic analysis, i.e., assign themes to the individual data points.

Below, you are provided with the identified themes.

THEMES
{{THEMES}}
'''
EXPECTED_OUTPUT_FILE = DATA_DIR / 'phase_4_output.txt'
DATA_FILE_DEFAULT = DATA_DIR / 'kradeze_pripady.json'
# ---


def construct_user_prompt(themes_list):
    # Load the template
    with open(USER_PROMPT_FILE, 'r') as f:
        user_prompt = f.read().strip()

    # Fill in definition fields
    with open(ANALYSIS_DEFINITION_FILE, 'r') as f:
        analysis_definition = json.load(f)
    for field, contents in analysis_definition.items():
        user_prompt = user_prompt.replace('{{' + field.upper() + '}}', contents)

    # Fill in phase fields
    user_prompt = user_prompt.replace('{{PHASE_NUM}}', PHASE_NUM)
    with open(PHASES_DEFINITION_FILE, 'r') as f:
        phases_definition = json.load(f)
    user_prompt = user_prompt.replace('{{PHASE_DESCRIPTION}}', phases_definition[PHASE_NUM])
    user_prompt = user_prompt.replace('{{PHASE_SPECS}}', PHASE_SPECS)

    # Fill in themes
    themes_str = ''
    for theme in themes_list:
        themes_str += f'- {str(theme).strip()}\n'
    themes_str += '\n'
    user_prompt = user_prompt.replace('{{THEMES}}', themes_str)

    # Expected output
    with open(EXPECTED_OUTPUT_FILE, 'r') as f:
        expected_output = f.read().strip()
    user_prompt = user_prompt.replace('{{EXPECTED_OUTPUT}}', expected_output)

    return user_prompt


def log_p4_progress_update(case_id, theme, progress_info):
    progress_data = {
        "type": "p4_progress",
        "case_id": case_id,
        "theme": theme,
        "progress": progress_info,
        "timestamp": datetime.datetime.now().isoformat()
    }
    print(f"P4_PROGRESS_UPDATE:{json.dumps(progress_data)}")
    logging.info(f"✅ Assigned theme for case {case_id}: '{str(theme)[:60]}'")


def log_p4_phase_update(phase, details=None):
    phase_data = {
        "type": "p4_phase",
        "phase": phase,
        "details": details or {},
        "timestamp": datetime.datetime.now().isoformat()
    }
    print(f"P4_PHASE_UPDATE:{json.dumps(phase_data)}")
    logging.info(f"Phase: {phase}")


def save_data_safely(data, filepath):
    try:
        with open(filepath, 'w', encoding='utf8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error(f"❌ Error saving data: {e}")
        return False


def main():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('analysis_p4.log'),
            logging.StreamHandler()
        ]
    )

    # Provider/model selection from environment (set by server)
    PROVIDER = os.getenv('MODEL_PROVIDER', 'gemini').lower()
    if PROVIDER == 'openai':
        SELECTED_MODEL = os.getenv('OPENAI_MODEL', 'gpt-5')
    elif PROVIDER == 'claude':
        SELECTED_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')
    else:  # gemini
        SELECTED_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')

    logging.info(f"Using provider: {PROVIDER}")
    logging.info(f"Using model: {SELECTED_MODEL}")

    parser = argparse.ArgumentParser(description='Phase 4 Final Theme Assignment')
    parser.add_argument('--data-file', type=str, help='Path to the data file to annotate')
    parser.add_argument('--themes-file', type=str, help='Path to final themes file (from P3b)')
    args = parser.parse_args()

    # Resolve files
    if args.data_file:
        if args.data_file.startswith('/'):
            DATA_FILE = Path(args.data_file)
        else:
            uploads_path = Path('uploads') / args.data_file
            if uploads_path.exists():
                DATA_FILE = uploads_path
            else:
                DATA_FILE = DATA_DIR / args.data_file
    else:
        DATA_FILE = DATA_FILE_DEFAULT

    if args.themes_file:
        if args.themes_file.startswith('/'):
            THEMES_FILE = Path(args.themes_file)
        else:
            candidate_path = Path('uploads') / args.themes_file
            THEMES_FILE = candidate_path if candidate_path.exists() else DATA_DIR / args.themes_file
    else:
        THEMES_FILE = THEMES_FILE_DEFAULT

    # Load data and themes
    if not DATA_FILE.exists():
        logging.error(f"❌ Data file not found: {DATA_FILE}")
        sys.exit(1)
    if not THEMES_FILE.exists():
        logging.error(f"❌ Themes file not found: {THEMES_FILE}")
        sys.exit(1)

    with open(DATA_FILE, 'r', encoding='utf8') as f:
        data = json.load(f)

    with open(THEMES_FILE, 'r', encoding='utf8') as f:
        themes_json = json.load(f)

    if isinstance(themes_json, dict):
        themes_list = list(themes_json.keys())
    elif isinstance(themes_json, list):
        # Support list of strings or list of objects with 'theme' field
        extracted = []
        for item in themes_json:
            if isinstance(item, str):
                extracted.append(item)
            elif isinstance(item, dict):
                if 'theme' in item:
                    extracted.append(str(item['theme']))
                else:
                    # take first key or value as best-effort
                    try:
                        extracted.append(str(next(iter(item.values()))))
                    except Exception:
                        pass
        themes_list = extracted
    else:
        themes_list = []

    theme_set = set([str(t).strip() for t in themes_list if str(t).strip()])

    with open(SYSTEM_PROMPT_FILE, 'r') as f:
        system_prompt = f.read().strip()

    total_cases = len(data)
    processed_cases = 0
    existing_themes = set()
    for v in data.values():
        if OUTPUT_FIELD in v and v[OUTPUT_FIELD]:
            processed_cases += 1
            try:
                if str(v[OUTPUT_FIELD]).strip():
                    existing_themes.add(str(v[OUTPUT_FIELD]).strip())
            except Exception:
                pass

    log_p4_phase_update("Initializing", {
        "total_cases": total_cases,
        "processed_cases": processed_cases,
        "unique_themes": len(existing_themes),
        "data_file": str(DATA_FILE),
        "themes_file": str(THEMES_FILE)
    })

    # Start processing
    remaining_cases = total_cases - processed_cases
    if remaining_cases > 0:
        log_p4_phase_update("Processing Cases", {
            "total_cases": total_cases,
            "processed_cases": processed_cases,
            "unique_themes": len(existing_themes)
        })

    # Build base prompt once with themes; we'll inject case data per iteration
    user_prompt_base = construct_user_prompt(sorted(theme_set) if theme_set else [])

    # Define get_provider_analysis function for provider abstraction
    def get_provider_analysis(sys_prompt, usr_prompt):
        if PROVIDER == 'gemini':
            return gemini_get_analysis(sys_prompt, usr_prompt)
        elif PROVIDER == 'claude':
            # Claude (Anthropic) path
            if anthropic is None:
                raise RuntimeError("Anthropic client not available")
            # Load API key
            with open('config.json') as cf:
                cfg = json.load(cf)
                anthropic_api_key = cfg.get('anthropic_api_key')
            if not anthropic_api_key:
                raise ValueError("anthropic_api_key not found in config.json")
            client = anthropic.Anthropic(api_key=anthropic_api_key)
            model_name = SELECTED_MODEL or 'claude-sonnet-4-20250514'
            response = client.messages.create(
                model=model_name,
                max_tokens=COMPLETION_LEN,
                temperature=0.7,
                system=sys_prompt,
                messages=[{"role": "user", "content": usr_prompt}]
            )
            content_text = response.content[0].text
            return {
                'system_prompt': sys_prompt,
                'user_prompt': usr_prompt,
                'params': {'model': model_name, 'temperature': 0.7},
                'choices': [{'message': {'content': content_text}}],
            }
        # OpenAI path
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

    max_retries = 3
    new_processed = 0
    for case_id, case_data in data.items():
        try:
            if OUTPUT_FIELD in case_data and str(case_data[OUTPUT_FIELD]).strip() in theme_set:
                continue

            case_text = case_data.get('plny_skutek_short') or case_data.get('plny_skutek') or ''
            case_data_prompt = (
                f"ID: {case_id}\n"
                f"{case_text}\n"
                f"---\n\n"
            )
            user_prompt = user_prompt_base.replace('{{DATA}}', case_data_prompt)

            # Try API with retries
            json_res = {}
            for attempt in range(max_retries):
                response = get_provider_analysis(system_prompt, user_prompt)
                json_res = response_to_json(response)
                if case_id in json_res:
                    break
                logging.warning(f"Attempt {attempt+1}/{max_retries}: Case {case_id} not found in response")

            if case_id not in json_res:
                logging.error(f"❌ Failed to assign theme for case {case_id}")
                continue

            assigned_theme = json_res[case_id]
            data[case_id][OUTPUT_FIELD] = assigned_theme
            if save_data_safely(data, DATA_FILE):
                new_processed += 1
                processed_cases += 1
                theme_str = str(assigned_theme).strip()
                if theme_str:
                    existing_themes.add(theme_str)
                log_p4_progress_update(
                    case_id=case_id,
                    theme=assigned_theme,
                    progress_info={
                        "processed": processed_cases,
                        "total": total_cases,
                        "unique_themes": len(existing_themes),
                        "percentage": round((processed_cases / total_cases) * 100, 1)
                    }
                )
            else:
                logging.error(f"❌ Failed to save assigned theme for case {case_id}")
        except Exception as e:
            logging.error(f"❌ Error processing case {case_id}: {e}")

    log_p4_phase_update("Complete", {
        "total_cases": total_cases,
        "processed_cases": processed_cases,
        "unique_themes": len(existing_themes),
        "new_cases_this_run": new_processed
    })


if __name__ == "__main__":
    main()
