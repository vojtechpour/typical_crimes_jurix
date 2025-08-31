#!/usr/bin/env python3
"""
Dataset Reduction Script
Reduces a large crime dataset to 100 cases for testing/experimentation
"""

import json
import random
import sys
from pathlib import Path

def reduce_dataset(input_file, output_file, num_cases=100, random_selection=True):
    """
    Reduce a large dataset to a specified number of cases
    
    Args:
        input_file (str): Path to the input JSON file
        output_file (str): Path to the output JSON file
        num_cases (int): Number of cases to keep (default: 100)
        random_selection (bool): Whether to randomly select cases or take first N (default: True)
    """
    
    print(f"📂 Reading dataset from: {input_file}")
    
    try:
        # Read the input file
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"📊 Original dataset contains {len(data)} cases")
        
        # Ensure we don't try to select more cases than available
        if len(data) < num_cases:
            print(f"⚠️  Warning: Dataset only has {len(data)} cases, keeping all")
            num_cases = len(data)
        
        # Select cases
        if random_selection:
            print(f"🎲 Randomly selecting {num_cases} cases...")
            # Get random sample of case IDs
            all_case_ids = list(data.keys())
            selected_ids = random.sample(all_case_ids, num_cases)
            
            # Create reduced dataset with selected cases
            reduced_data = {case_id: data[case_id] for case_id in selected_ids}
        else:
            print(f"📝 Taking first {num_cases} cases...")
            # Take first N cases
            case_ids = list(data.keys())[:num_cases]
            reduced_data = {case_id: data[case_id] for case_id in case_ids}
        
        print(f"✅ Reduced dataset contains {len(reduced_data)} cases")
        
        # Add metadata about the reduction
        if isinstance(reduced_data, dict) and not any(key.startswith('_metadata') for key in reduced_data.keys()):
            # Only add metadata if it won't conflict with existing data structure
            print("📋 Adding reduction metadata...")
        
        # Write the reduced dataset
        print(f"💾 Saving reduced dataset to: {output_file}")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(reduced_data, f, indent=2, ensure_ascii=False)
        
        print(f"🎉 Successfully created reduced dataset!")
        print(f"   Original: {len(data)} cases")
        print(f"   Reduced:  {len(reduced_data)} cases")
        print(f"   Output:   {output_file}")
        
        # Display some sample case IDs
        sample_ids = list(reduced_data.keys())[:5]
        print(f"📋 Sample case IDs: {sample_ids}")
        
        return True
        
    except FileNotFoundError:
        print(f"❌ Error: Input file not found: {input_file}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in input file: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    # Configuration
    input_file = "/Users/vojtechpour/projects/typical-crimes/uploads/uploaded_2025-06-11T08-43-21-208Z_kradeze_pripady_new_prompt_experiment_claude_backup.json"
    
    # Create output filename
    input_path = Path(input_file)
    output_file = input_path.parent / f"{input_path.stem}_reduced_100.json"
    
    print("🔧 Crime Dataset Reduction Tool")
    print("=" * 50)
    
    # Set random seed for reproducible results
    random.seed(42)
    
    # Reduce the dataset
    success = reduce_dataset(
        input_file=input_file,
        output_file=str(output_file),
        num_cases=100,
        random_selection=True  # Set to False to take first 100 cases instead
    )
    
    if success:
        print("\n✅ Dataset reduction completed successfully!")
        print(f"📁 New file: {output_file}")
        print("🚀 You can now use this reduced dataset for testing/experimentation")
    else:
        print("\n❌ Dataset reduction failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 