import json
from pathlib import Path

DATA_DIR = Path('data')
USER_PROMPT_FILE = DATA_DIR / 'user_prompt.txt'
SYSTEM_PROMPT_FILE = DATA_DIR / 'system_prompt.txt'
ANALYSIS_DEFINITION_FILE = DATA_DIR / 'crimes_analysis_definition.json'
PHASES_DEFINITION_FILE = DATA_DIR / 'phases_definition.json'
EXPECTED_OUTPUT_FILE = DATA_DIR / 'phase_2_output.txt'
DATA_FILE = DATA_DIR / 'kradeze_pripady.json'

PHASE_NUM = '2'
PHASE_SPECS = '''Perform phase 2 of the thematic analysis, i.e., generate initial codes. 

Below, you are provided with all already generated initial codes from the previous batches of analyzed data points. When defining the codes try to be consistent so that similar data points are coded consistently. On the other hand, try to be as specific as possible, i.e., do not use too general codes.

ALREADY IDENTIFIED INITIAL CODES
{{INITIAL_CODES}}
'''

def construct_sample_prompt():
    # Load user prompt template
    with open(USER_PROMPT_FILE, 'r') as f:
        user_prompt = f.read().strip()
    
    # Fill in analysis definition fields
    with open(ANALYSIS_DEFINITION_FILE, 'r') as f:
        analysis_definition = json.load(f)
    for field, contents in analysis_definition.items():
        user_prompt = user_prompt.replace('{{' + field.upper() + '}}', contents)

    # Fill in phase information
    user_prompt = user_prompt.replace('{{PHASE_NUM}}', PHASE_NUM)
    with open(PHASES_DEFINITION_FILE, 'r') as f:
        phases_definition = json.load(f)
    user_prompt = user_prompt.replace('{{PHASE_DESCRIPTION}}', phases_definition[PHASE_NUM])
    user_prompt = user_prompt.replace('{{PHASE_SPECS}}', PHASE_SPECS)

    # Add sample existing codes
    sample_codes = [
        "opportunistic theft of unattended personal items in workplace",
        "systematic theft of small valuable items over time", 
        "theft from unlocked vehicles in public areas",
        "shoplifting of consumable goods",
        "burglary with forced entry to obtain specific items"
    ]
    codes_text = '\n'.join(f'- {code}' for code in sample_codes)
    user_prompt = user_prompt.replace('{{INITIAL_CODES}}', codes_text)
    
    # Add sample data
    sample_data = '''ID: 31751427
Dne 3.1.2017 v době kolem 13:00 hodin v XXX, obviněný vzal ze židle kabát kolegy v hodnotě 800,- Kč.
---

ID: 31757383
v Brně v OD Tesco v nákupním centru Královo pole odcizil obviněný různé potraviny v celkové hodnotě 156,- Kč.
---'''
    
    user_prompt = user_prompt.replace('{{DATA}}', sample_data)
    
    # Add expected output format
    with open(EXPECTED_OUTPUT_FILE, 'r') as f:
        expected_output = f.read().strip()
    user_prompt = user_prompt.replace('{{EXPECTED_OUTPUT}}', expected_output)
    
    return user_prompt

# Show system prompt
print("=" * 80)
print("SYSTEM PROMPT (Sent to Gemini)")
print("=" * 80)
with open(SYSTEM_PROMPT_FILE, 'r') as f:
    system_prompt = f.read().strip()
print(system_prompt)

print("\n\n" + "=" * 80)
print("USER PROMPT (Sent to Gemini)")
print("=" * 80)
user_prompt = construct_sample_prompt()
print(user_prompt)

print("\n\n" + "=" * 80)
print("PROMPT COMPONENTS THAT AFFECT INITIAL CODES:")
print("=" * 80)
print("1. RESEARCH CONTEXT (from crimes_analysis_definition.json)")
print("2. PHASE 2 DESCRIPTION (from phases_definition.json)")
print("3. CONSISTENCY INSTRUCTIONS (existing codes)")
print("4. OUTPUT FORMAT (JSON structure)")
print("5. ACTUAL CRIME CASE DATA")
print("=" * 80) 