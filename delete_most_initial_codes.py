#!/usr/bin/env python3
"""
Script to delete all initial codes from all cases except one
Keeps initial codes in only ONE case, removes from all others
"""

import json
import sys
from pathlib import Path

def delete_most_initial_codes(file_path):
    """Delete all initial codes except from one case"""
    print(f"Processing file: {file_path}")
    
    try:
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Total cases in file: {len(data)}")
        
        # Find all cases with initial codes
        cases_with_codes = []
        for case_id, case_data in data.items():
            initial_code_keys = [key for key in case_data.keys() if 'initial_code' in key.lower()]
            if initial_code_keys:
                cases_with_codes.append((case_id, initial_code_keys))
        
        print(f"Found {len(cases_with_codes)} cases with initial codes")
        
        if not cases_with_codes:
            print("No cases with initial codes found!")
            return False
        
        # Show the first case (the one we'll keep)
        keep_case_id, keep_keys = cases_with_codes[0]
        print(f"\nWill KEEP initial codes in case: {keep_case_id}")
        print(f"Keys to keep: {keep_keys}")
        if keep_keys:
            for key in keep_keys:
                print(f"  {key}: {data[keep_case_id][key]}")
        
        print(f"\nWill DELETE initial codes from {len(cases_with_codes) - 1} other cases")
        
        # Ask for confirmation
        response = input(f"\nDo you want to proceed? This will delete initial codes from {len(cases_with_codes) - 1} cases (y/N): ")
        if response.lower() != 'y':
            print("Operation cancelled.")
            return False
        
        # Create backup first
        backup_path = str(file_path).replace('.json', '_backup_before_deletion.json')
        with open(file_path, 'r', encoding='utf-8') as f:
            backup_data = f.read()
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(backup_data)
        print(f"Created backup: {backup_path}")
        
        # Delete initial codes from all cases except the first one
        deleted_count = 0
        for case_id, initial_code_keys in cases_with_codes[1:]:  # Skip the first case
            for key in initial_code_keys:
                del data[case_id][key]
            deleted_count += 1
        
        # Save the modified data
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ SUCCESS!")
        print(f"Deleted initial codes from {deleted_count} cases")
        print(f"Kept initial codes in 1 case: {keep_case_id}")
        print(f"Modified file saved: {file_path}")
        print(f"Backup saved: {backup_path}")
        
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    file_path = "/Users/vojtechpour/projects/typical-crimes/uploads/uploaded_2025-06-11T08-43-21-208Z_kradeze_pripady_new_prompt_experiment_claude.json"
    
    # Check if file exists
    if not Path(file_path).exists():
        print(f"File not found: {file_path}")
        return
    
    # Process the file
    success = delete_most_initial_codes(file_path)
    
    if success:
        print("\n🎉 Operation completed successfully!")
    else:
        print("\n❌ Operation failed or was cancelled.")

if __name__ == "__main__":
    main() 