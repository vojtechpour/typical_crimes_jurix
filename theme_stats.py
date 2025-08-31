import json
from collections import Counter
from pathlib import Path

# Load the data
DATA_FILE = Path('data') / 'kradeze_pripady.json'

with open(DATA_FILE, 'r', encoding='utf8') as f:
    data = json.load(f)

# Extract candidate themes
candidate_themes = []
cases_with_themes = 0
total_cases = len(data)

for case_id, case_data in data.items():
    if 'candidate_theme' in case_data:
        candidate_themes.append(case_data['candidate_theme'])
        cases_with_themes += 1

# Generate statistics
theme_counts = Counter(candidate_themes)
unique_themes = len(theme_counts)

print("=== CANDIDATE THEME STATISTICS ===")
print(f"Total cases in dataset: {total_cases:,}")
print(f"Cases with candidate themes: {cases_with_themes:,}")
print(f"Cases without candidate themes: {total_cases - cases_with_themes:,}")
print(f"Unique themes identified: {unique_themes}")
print()

if candidate_themes:
    print("=== THEME FREQUENCY DISTRIBUTION ===")
    print(f"{'Rank':<4} {'Count':<6} {'Theme'}")
    print("-" * 80)
    
    for rank, (theme, count) in enumerate(theme_counts.most_common(), 1):
        percentage = (count / cases_with_themes) * 100
        print(f"{rank:<4} {count:<6} ({percentage:4.1f}%) {theme}")
    
    print()
    print("=== SUMMARY STATISTICS ===")
    most_common_theme, max_count = theme_counts.most_common(1)[0]
    least_common_count = min(theme_counts.values())
    avg_count = sum(theme_counts.values()) / len(theme_counts)
    
    print(f"Most common theme: '{most_common_theme}' ({max_count} cases)")
    print(f"Least common theme count: {least_common_count}")
    print(f"Average cases per theme: {avg_count:.1f}")
    
    # Distribution by frequency
    frequency_dist = Counter(theme_counts.values())
    print()
    print("=== FREQUENCY DISTRIBUTION ===")
    print("Themes appearing X times:")
    for freq in sorted(frequency_dist.keys(), reverse=True):
        count = frequency_dist[freq]
        print(f"  {freq} times: {count} themes")
    
    # Top themes that would be included in top 1000
    print()
    print("=== TOP 1000 THEMES (for Phase 3 memory) ===")
    top_1000 = theme_counts.most_common(1000)
    if len(top_1000) == 1000:
        threshold_count = top_1000[999][1]
        print(f"Top 1000 threshold: themes with {threshold_count}+ occurrences")
    else:
        print(f"Only {len(top_1000)} themes total (less than 1000)")
        print("All themes will be included in Phase 3 memory")
    
else:
    print("No candidate themes found in the dataset.")
    print("Run analysis_p3.py first to generate candidate themes.") 