import json

# Load the experimental data
with open('data/kradeze_pripady_new_prompt_experiment.json', 'r', encoding='utf8') as f:
    data = json.load(f)

# Count existing initial_code_0 fields (note the _0 suffix)
initial_count = sum(1 for item in data.values() if 'initial_code_0' in item)
print(f'Found {initial_count} cases with initial_code_0 fields')

# Remove all initial_code_0 fields
removed_count = 0
for case_id, case_data in data.items():
    if 'initial_code_0' in case_data:
        del case_data['initial_code_0']
        removed_count += 1

print(f'Removed {removed_count} initial_code_0 fields')

# Save the cleaned data
with open('data/kradeze_pripady_new_prompt_experiment.json', 'w', encoding='utf8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('✅ All initial_code_0 fields have been deleted from the experimental JSON file')
print(f'Total cases in experimental dataset: {len(data)}') 