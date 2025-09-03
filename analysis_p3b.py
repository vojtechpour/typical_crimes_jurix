from collections import Counter
import json
from pathlib import Path
from gemini_api import get_analysis, response_to_json, COMPLETION_LEN, MODEL


DATA_DIR = Path('data')
USER_PROMPT_FILE = DATA_DIR / 'user_prompt.txt'
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'
PROMPT_LIMIT = 160000  # Updated to 160,000 tokens
OUTPUT_FIELD = 'final_theme'


# ---
ANALYSIS_DEFINITION_FILE = DATA_DIR / 'crimes_analysis_definition.json'
PHASES_DEFINITION_FILE = DATA_DIR / 'phases_definition.json'
PHASE_NUM = '3'
PHASE_SPECS = '''Perform phase 3b of the thematic analysis, i.e., finalize themes.

You will be provided by batches of candidate themes generated through the previous phase of the analysis. Your task is to create a final, refined and consistent set of themes. All the themes should be mutually exclusive, and they should also cover the whole spectrum of the analyzed data.

Below, you are provided with a subset of already identified final themes from the previous batches of analyzed themes. When defining the new themes try to be consistent so that similar initial codes are assigned with exactly the same theme. Only introduce new themes when absolutely necessary.

ALREADY IDENTIFIED THEMES
{{FINAL_THEMES}}
'''
EXPECTED_OUTPUT_FILE = DATA_DIR / 'phase_3b_output.txt'
DATA_FILE = DATA_DIR / 'kradeze_pripady.json'
DATA_FILE_OUT = DATA_DIR / 'kradeze_pripady_3b.json'
# ---


def construct_user_prompt(candidate_themes):
    with open(USER_PROMPT_FILE, 'r') as f:
        user_prompt = f.read().strip()
        
    with open(ANALYSIS_DEFINITION_FILE, 'r') as f:
        analysis_definition = json.load(f)
    for field, contents in analysis_definition.items():
        user_prompt = user_prompt.replace('{{' + field.upper() + '}}', contents)

    user_prompt = user_prompt.replace('{{PHASE_NUM}}', PHASE_NUM)
    with open(PHASES_DEFINITION_FILE, 'r') as f:
        phases_definition = json.load(f)
    user_prompt = user_prompt.replace('{{PHASE_DESCRIPTION}}',
                                    phases_definition[PHASE_NUM])
    user_prompt = user_prompt.replace('{{PHASE_SPECS}}', PHASE_SPECS)
    themes_text = '\n'.join(f'- {ct} ({num} data points)'.replace('\n', ' ') for ct, num in Counter(candidate_themes).most_common(len(Counter(candidate_themes))))
    user_prompt = user_prompt.replace('{{CANDIDATE_THEMES}}', themes_text)
    with open(EXPECTED_OUTPUT_FILE, 'r') as f:
        expected_output = f.read().strip()
    user_prompt = user_prompt.replace('{{EXPECTED_OUTPUT}}', expected_output)
    return user_prompt

with open(DATA_FILE, 'r', encoding='utf8') as f:
    data = json.load(f)
candidate_themes = [dp[OUTPUT_FIELD] for dp in data.values() if OUTPUT_FIELD in dp]
user_prompt = construct_user_prompt(candidate_themes)
with open(SYSTEM_PROMPT_FILE, 'r') as f:
    system_prompt = f.read().strip()

# Estimate token usage in a model-agnostic way (≈ 1 token per 4 chars)
def count_tokens_estimate(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)

base_user_tokens = count_tokens_estimate(user_prompt)
base_system_tokens = count_tokens_estimate(system_prompt)
prompt_length_base = base_user_tokens + base_system_tokens + COMPLETION_LEN
user_prompt = user_prompt.replace('THE SUBSET OF THE DATA POINTS TO BE ANALYZED\n{{DATA}}', '')

print(user_prompt)

response = get_analysis(system_prompt, user_prompt)
json_res = response_to_json(response)
with open(DATA_FILE_OUT, 'w', encoding='utf8') as f:
    json.dump(json_res, f, indent=2, ensure_ascii=False)
