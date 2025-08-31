import json
from pathlib import Path

# File to clean
input_file = Path('data/kradeze_pripady_test_100_2_balanced_dedupl_claude_multiple_initial_codes.json')

print(f"Cleaning initial_code_0 fields from {input_file}")

# Load the data
with open(input_file, 'r', encoding='utf8') as f:
    data = json.load(f)

print(f"Total cases in file: {len(data)}")

# Count how many have initial_code_0
cases_with_field = sum(1 for dp in data.values() if 'initial_code_0' in dp)
print(f"Cases with initial_code_0 field: {cases_with_field}")

# Remove initial_code_0 fields
for case_id, case_data in data.items():
    if 'initial_code_0' in case_data:
        del case_data['initial_code_0']

# Save the cleaned data
with open(input_file, 'w', encoding='utf8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"✅ Cleaned file saved. Removed initial_code_0 from {cases_with_field} cases.") 