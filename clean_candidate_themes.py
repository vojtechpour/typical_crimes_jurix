import json
from pathlib import Path

# File to clean
input_file = Path('data/kradeze_pripady_test_100_2_balanced_dedupl_claude_multiple_initial_codes.json')

print(f"Cleaning candidate_theme fields from {input_file}")

# Load the data
with open(input_file, 'r', encoding='utf8') as f:
    data = json.load(f)

print(f"Total cases in file: {len(data)}")

# Count how many have candidate_theme
cases_with_field = sum(1 for dp in data.values() if 'candidate_theme' in dp)
print(f"Cases with candidate_theme field: {cases_with_field}")

# Remove candidate_theme fields
for case_id, case_data in data.items():
    if 'candidate_theme' in case_data:
        del case_data['candidate_theme']

# Save the cleaned data
with open(input_file, 'w', encoding='utf8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"✅ Cleaned file saved. Removed candidate_theme from {cases_with_field} cases.") 