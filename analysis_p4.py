from collections import Counter
import json
from pathlib import Path
import tiktoken
import sys
from gemini_api import get_analysis, response_to_json, COMPLETION_LEN


DATA_DIR = Path('data')
USER_PROMPT_FILE = DATA_DIR / 'user_prompt.txt'
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'
PROMPT_LIMIT = 160000
OUTPUT_FIELD = 'theme'


# ---
ANALYSIS_DEFINITION_FILE = DATA_DIR / 'crimes_analysis_definition.json'
THEMES_FILE = DATA_DIR / 'kradeze_pripady_3b.json'
PHASES_DEFINITION_FILE = DATA_DIR / 'phases_definition.json'
PHASE_NUM = '4'
PHASE_SPECS = '''Perform phase 4 of the thematic analysis, i.e., assign themes to the individual data points.

Below, you are provided with the identified themes.

THEMES
{{THEMES}}
'''
EXPECTED_OUTPUT_FILE = DATA_DIR / 'phase_4_output.txt'
DATA_FILE = DATA_DIR / 'kradeze_pripady.json'
MODEL = 'gemini-2.0-flash-exp'
# ---


def construct_user_prompt(initial_codes):
    # load the tempplate
    with open(USER_PROMPT_FILE, 'r') as f:
        user_prompt = f.read().strip()
    
    # fill in definition fields
    with open(ANALYSIS_DEFINITION_FILE, 'r') as f:
        analysis_definition = json.load(f)
    for field, contents in analysis_definition.items():
        user_prompt = user_prompt.replace('{{' + field.upper() + '}}', contents)

    # fill in phase fields
    user_prompt = user_prompt.replace('{{PHASE_NUM}}', PHASE_NUM)
    with open(PHASES_DEFINITION_FILE, 'r') as f:
        phases_definition = json.load(f)
    user_prompt = user_prompt.replace('{{PHASE_DESCRIPTION}}',
                                    phases_definition[PHASE_NUM])
    user_prompt = user_prompt.replace('{{PHASE_SPECS}}', PHASE_SPECS)

    # fill in themes
    with open(THEMES_FILE, 'r') as f:
        themes = json.load(f)
    themes_str = ''
    for theme in themes.keys():
        themes_str += f'- {theme}\n'
    themes_str += '\n'
    user_prompt = user_prompt.replace('{{THEMES}}', themes_str)
    
    # expected output
    with open(EXPECTED_OUTPUT_FILE, 'r') as f:
        expected_output = f.read().strip()
    user_prompt = user_prompt.replace('{{EXPECTED_OUTPUT}}', expected_output)
    
    return user_prompt


with open(DATA_FILE, 'r', encoding='utf8') as f:
    data = json.load(f)
candidate_codes = [dp[OUTPUT_FIELD] for dp in data.values() if OUTPUT_FIELD in dp]
user_prompt = construct_user_prompt(candidate_codes)
with open(SYSTEM_PROMPT_FILE, 'r') as f:
    system_prompt = f.read().strip()
encoding = tiktoken.encoding_for_model(MODEL)
prompt_length_base = (
    len(encoding.encode(user_prompt)) + 
    len(encoding.encode(system_prompt)) + 
    COMPLETION_LEN
)

with open(THEMES_FILE, 'r') as f:
        themes = json.load(f)
theme_set = set(themes.keys())
data_prompt_len = 0
data_prompt = '\n'
num_dp = 0
for id_slt, data_point in data.items():
    if OUTPUT_FIELD in data_point and data_point[OUTPUT_FIELD] in theme_set:
        continue
    dp_len = len(encoding.encode(data_point['plny_skutek_short'])) + 10
    if prompt_length_base + data_prompt_len + dp_len > PROMPT_LIMIT:
        print(f'Submitted {data_prompt_len} data tokens ({num_dp} data points).')
        user_prompt = construct_user_prompt(candidate_codes)
        print(user_prompt)
        print('=' * 80)
        prompt_length_base = (
            len(encoding.encode(user_prompt)) + 
            len(encoding.encode(system_prompt)) + 
            COMPLETION_LEN
        )
        user_prompt_w_data = user_prompt.replace('{{DATA}}', data_prompt)
        data_prompt = '\n'
        output_json = []
        response = get_analysis(system_prompt, user_prompt_w_data)
        json_res = response_to_json(response)
        for id, init_code in json_res.items():
            if '_' in id:
                id = id.split('_')[0]
            if id not in data:
                print(f'WARNING: ID {id} not found in data.')
                continue
            data[id][OUTPUT_FIELD] = init_code
            candidate_codes.append(init_code)
        with open(DATA_FILE, 'w', encoding='utf8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        num_dp = 0
    data_prompt += (
        f'ID: {id_slt}\n'
        f'{data_point["plny_skutek_short"]}\n'
        f'---\n\n'
    )
    data_prompt_len = len(encoding.encode(data_prompt))
    num_dp += 1

# last unfinished batch
print(f'Submitted {data_prompt_len} data tokens ({num_dp} data points).')
user_prompt_w_data = user_prompt.replace('{{DATA}}', data_prompt)
data_prompt = '\n'
output_json = []
response = get_analysis(system_prompt, user_prompt_w_data)
json_res = response_to_json(response)
for id, init_code in json_res.items():
    if '_' in id:
        id = id.split('_')[0]
    if id not in data:
        print(f'WARNING: ID {id} not found in data.')
        continue
    data[id][OUTPUT_FIELD] = init_code
with open(DATA_FILE, 'w', encoding='utf8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
