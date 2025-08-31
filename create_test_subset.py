import json

def create_test_subset():
    # Load the original data
    print("Loading original dataset...")
    with open('data/kradeze_pripady.json', 'r', encoding='utf8') as f:
        original_data = json.load(f)
    
    print(f"Original dataset contains {len(original_data)} cases")
    
    # Get first 100 cases
    case_ids = list(original_data.keys())[:100]
    print(f"Extracting first {len(case_ids)} cases...")
    
    # Create subset with first 100 cases
    test_subset = {}
    removed_codes_count = 0
    
    for case_id in case_ids:
        # Copy the case data
        case_data = original_data[case_id].copy()
        
        # Remove initial_code_0 field if it exists
        if 'initial_code_0' in case_data:
            del case_data['initial_code_0']
            removed_codes_count += 1
        
        test_subset[case_id] = case_data
    
    # Save the test subset
    output_file = 'data/kradeze_pripady_test_100.json'
    with open(output_file, 'w', encoding='utf8') as f:
        json.dump(test_subset, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Test subset created: {output_file}")
    print(f"Cases in subset: {len(test_subset)}")
    print(f"Initial codes removed: {removed_codes_count}")
    print(f"Clean cases ready for testing: {len(test_subset)}")
    
    # Show some sample case IDs
    sample_ids = list(test_subset.keys())[:5]
    print(f"Sample case IDs: {sample_ids}")

if __name__ == "__main__":
    create_test_subset() 