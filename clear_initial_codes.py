import json
import shutil
from datetime import datetime

# File paths
DATA_FILE = 'data/kradeze_pripady.json'
BACKUP_FILE = f'data/kradeze_pripady_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'

print("🔄 Clearing initial_code fields from dataset...")

# Create backup first
print(f"📦 Creating backup: {BACKUP_FILE}")
shutil.copy2(DATA_FILE, BACKUP_FILE)

# Load the data
with open(DATA_FILE, 'r', encoding='utf8') as f:
    data = json.load(f)

print(f"📊 Total cases in dataset: {len(data)}")

# Count how many cases have initial_code fields
initial_code_count = 0
initial_code_0_count = 0

for case_id, case_data in data.items():
    if 'initial_code' in case_data:
        initial_code_count += 1
    if 'initial_code_0' in case_data:
        initial_code_0_count += 1

print(f"🔍 Found:")
print(f"  - {initial_code_count} cases with 'initial_code' field")
print(f"  - {initial_code_0_count} cases with 'initial_code_0' field")

# Remove the fields
removed_initial_code = 0
removed_initial_code_0 = 0

for case_id, case_data in data.items():
    if 'initial_code' in case_data:
        del case_data['initial_code']
        removed_initial_code += 1
    
    if 'initial_code_0' in case_data:
        del case_data['initial_code_0']  
        removed_initial_code_0 += 1

print(f"\n🗑️  Removed:")
print(f"  - {removed_initial_code} 'initial_code' fields")
print(f"  - {removed_initial_code_0} 'initial_code_0' fields")

# Save the cleaned data
with open(DATA_FILE, 'w', encoding='utf8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\n✅ Data cleaned and saved to: {DATA_FILE}")
print(f"📦 Backup available at: {BACKUP_FILE}")

# Verify the cleanup
with open(DATA_FILE, 'r', encoding='utf8') as f:
    verified_data = json.load(f)

remaining_initial_code = sum(1 for case in verified_data.values() if 'initial_code' in case)
remaining_initial_code_0 = sum(1 for case in verified_data.values() if 'initial_code_0' in case)

print(f"\n🔍 Verification:")
print(f"  - Remaining 'initial_code' fields: {remaining_initial_code}")
print(f"  - Remaining 'initial_code_0' fields: {remaining_initial_code_0}")

if remaining_initial_code == 0 and remaining_initial_code_0 == 0:
    print("✅ All initial code fields successfully removed!")
    print("🚀 Ready to start fresh analysis!")
else:
    print("⚠️  Some fields may still remain - please check manually")

print(f"\n📝 You can now run: python analysis_p2.py")
print(f"   (or the fast version when you recreate it)") 