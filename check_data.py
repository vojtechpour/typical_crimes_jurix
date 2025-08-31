import json

with open('data/kradeze_pripady.json', 'r', encoding='utf8') as f:
    data = json.load(f)

print(f'Total cases in dataset: {len(data)}')
print('\nChecking first 10 cases for differences between plny_skutek and plny_skutek_short:')

identical_count = 0
different_count = 0
different_cases = []

for i, (case_id, case) in enumerate(data.items()):
    if i >= 10:  # Only check first 10 cases
        break
    
    if 'plny_skutek' in case and 'plny_skutek_short' in case:
        if case['plny_skutek'] == case['plny_skutek_short']:
            identical_count += 1
            print(f'Case {i+1} ({case_id}): ✅ Identical ({len(case["plny_skutek"])} chars)')
        else:
            different_count += 1
            different_cases.append(case_id)
            print(f'Case {i+1} ({case_id}): ❌ Different')
            print(f'  plny_skutek: {len(case["plny_skutek"])} chars')
            print(f'  plny_skutek_short: {len(case["plny_skutek_short"])} chars')
            print(f'  First 100 chars of plny_skutek: "{case["plny_skutek"][:100]}..."')
            print(f'  First 100 chars of plny_skutek_short: "{case["plny_skutek_short"][:100]}..."')
    else:
        print(f'Case {i+1} ({case_id}): ⚠️  Missing one or both fields')

print(f'\nSummary of first 10 cases:')
print(f'Identical: {identical_count}')
print(f'Different: {different_count}')

if different_cases:
    print(f'Cases with differences: {different_cases}') 