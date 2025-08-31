import json
from collections import defaultdict

def load_data(filename):
    """Load JSON data from file"""
    try:
        with open(filename, 'r', encoding='utf8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File {filename} not found")
        return {}

def compare_initial_codes():
    # Load both datasets
    print("Loading datasets...")
    original_data = load_data('data/kradeze_pripady.json')
    experiment_data = load_data('data/kradeze_pripady_new_prompt_experiment.json')
    
    if not original_data or not experiment_data:
        return
    
    print(f"Original dataset: {len(original_data)} cases")
    print(f"Experimental dataset: {len(experiment_data)} cases")
    print()
    
    # Find cases with codes in both datasets
    original_coded = {case_id: case_data.get('initial_code_0') 
                     for case_id, case_data in original_data.items() 
                     if 'initial_code_0' in case_data}
    
    experiment_coded = {case_id: case_data.get('initial_code_0') 
                       for case_id, case_data in experiment_data.items() 
                       if 'initial_code_0' in case_data}
    
    print(f"Original coded cases: {len(original_coded)}")
    print(f"Experimental coded cases: {len(experiment_coded)}")
    print()
    
    # Find common cases that have codes in both datasets
    common_cases = set(original_coded.keys()) & set(experiment_coded.keys())
    print(f"Cases coded in both datasets: {len(common_cases)}")
    print()
    
    if not common_cases:
        print("No common coded cases found for comparison.")
        return
    
    # Compare codes for common cases
    identical_codes = 0
    different_codes = []
    
    for case_id in common_cases:
        orig_code = original_coded[case_id]
        exp_code = experiment_coded[case_id]
        
        # Handle lists (flatten them to strings for comparison)
        if isinstance(orig_code, list):
            orig_code = str(orig_code)
        if isinstance(exp_code, list):
            exp_code = str(exp_code)
            
        if orig_code == exp_code:
            identical_codes += 1
        else:
            different_codes.append((case_id, orig_code, exp_code))
    
    print("=== COMPARISON RESULTS ===")
    print(f"Identical codes: {identical_codes}/{len(common_cases)} ({identical_codes/len(common_cases)*100:.1f}%)")
    print(f"Different codes: {len(different_codes)}/{len(common_cases)} ({len(different_codes)/len(common_cases)*100:.1f}%)")
    print()
    
    # Show examples of differences
    if different_codes:
        print("=== EXAMPLES OF DIFFERENCES ===")
        print("Format: Case ID | Original Format → Experimental Format")
        print("-" * 80)
        
        for i, (case_id, orig_code, exp_code) in enumerate(different_codes[:20]):  # Show first 20
            print(f"{case_id} | {orig_code} → {exp_code}")
        
        if len(different_codes) > 20:
            print(f"... and {len(different_codes) - 20} more differences")
        print()
    
    # Analyze code format patterns
    print("=== CODE FORMAT ANALYSIS ===")
    
    # Count underscore vs natural language patterns
    orig_underscore = sum(1 for code in original_coded.values() 
                         if isinstance(code, str) and '_' in code and code.count('_') >= 2)
    exp_underscore = sum(1 for code in experiment_coded.values() 
                        if isinstance(code, str) and '_' in code and code.count('_') >= 2)
    
    print(f"Original dataset - Underscore format codes: {orig_underscore}/{len(original_coded)} ({orig_underscore/len(original_coded)*100:.1f}%)")
    print(f"Experimental dataset - Underscore format codes: {exp_underscore}/{len(experiment_coded)} ({exp_underscore/len(experiment_coded)*100:.1f}%)")
    print()
    
    # Cases only in one dataset
    only_original = set(original_coded.keys()) - set(experiment_coded.keys())
    only_experiment = set(experiment_coded.keys()) - set(original_coded.keys())
    
    print("=== COVERAGE ANALYSIS ===")
    print(f"Cases coded only in original: {len(only_original)}")
    print(f"Cases coded only in experimental: {len(only_experiment)}")
    
    if only_original:
        print(f"Examples of original-only cases: {list(only_original)[:5]}")
    if only_experiment:
        print(f"Examples of experimental-only cases: {list(only_experiment)[:5]}")

if __name__ == "__main__":
    compare_initial_codes() 