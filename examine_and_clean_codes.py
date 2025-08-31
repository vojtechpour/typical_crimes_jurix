#!/usr/bin/env python3
"""
Script to examine and clean initial codes from JSON file
Keeps only one initial code per case
"""

import json
import sys
from pathlib import Path

def examine_file_structure(file_path):
    """Examine the structure of the JSON file"""
    print(f"Examining file: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Total cases in file: {len(data)}")
        
        # Look at first few cases to understand structure
        case_count = 0
        cases_with_codes = 0
        
        for case_id, case_data in data.items():
            case_count += 1
            if case_count <= 3:  # Show first 3 cases
                print(f"\nCase {case_id}:")
                for key, value in case_data.items():
                    if 'initial_code' in key.lower():
                        print(f"  {key}: {value}")
                    elif key in ['plny_skutek_short']:
                        print(f"  {key}: {str(value)[:100]}...")
                    else:
                        print(f"  {key}: {type(value).__name__}")
            
            # Count cases with initial codes
            has_codes = any('initial_code' in key.lower() for key in case_data.keys())
            if has_codes:
                cases_with_codes += 1
        
        print(f"\nSummary:")
        print(f"Total cases: {case_count}")
        print(f"Cases with initial codes: {cases_with_codes}")
        
        return data
        
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

def clean_initial_codes(data):
    """Clean the data to keep only one initial code per case"""
    print("\nCleaning initial codes...")
    
    cases_modified = 0
    
    for case_id, case_data in data.items():
        # Find all initial code keys
        initial_code_keys = [key for key in case_data.keys() if 'initial_code' in key.lower()]
        
        if len(initial_code_keys) > 1:
            # Keep only the first initial code (initial_code_0)
            keep_key = 'initial_code_0' if 'initial_code_0' in initial_code_keys else initial_code_keys[0]
            
            # Remove all other initial code keys
            for key in initial_code_keys:
                if key != keep_key:
                    del case_data[key]
            
            cases_modified += 1
    
    print(f"Modified {cases_modified} cases")
    return data

def save_cleaned_data(data, file_path):
    """Save the cleaned data back to file"""
    try:
        # Create backup first
        backup_path = str(file_path).replace('.json', '_backup.json')
        with open(file_path, 'r', encoding='utf-8') as f:
            backup_data = f.read()
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(backup_data)
        print(f"Created backup: {backup_path}")
        
        # Save cleaned data
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"Saved cleaned data to: {file_path}")
        return True
        
    except Exception as e:
        print(f"Error saving file: {e}")
        return False

def main():
    file_path = "/Users/vojtechpour/projects/typical-crimes/uploads/uploaded_2025-06-11T08-43-21-208Z_kradeze_pripady_new_prompt_experiment_claude.json"
    
    # Check if file exists
    if not Path(file_path).exists():
        print(f"File not found: {file_path}")
        return
    
    # Examine file structure
    data = examine_file_structure(file_path)
    if data is None:
        return
    
    # Ask for confirmation
    response = input("\nDo you want to proceed with cleaning (keep only one initial code per case)? (y/N): ")
    if response.lower() != 'y':
        print("Operation cancelled.")
        return
    
    # Clean the data
    cleaned_data = clean_initial_codes(data)
    
    # Save the cleaned data
    if save_cleaned_data(cleaned_data, file_path):
        print("\nOperation completed successfully!")
        
        # Show final summary
        cases_with_codes = sum(1 for case_data in cleaned_data.values() 
                              if any('initial_code' in key.lower() for key in case_data.keys()))
        print(f"Final result: {cases_with_codes} cases with initial codes")
    else:
        print("Failed to save cleaned data.")

if __name__ == "__main__":
    main() 