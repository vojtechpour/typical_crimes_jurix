import json
import numpy as np
import pandas as pd
from pathlib import Path
from openai import OpenAI
import time
from collections import Counter
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('embeddings.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
DATA_FILE = Path('data') / 'kradeze_pripady_backup_20250609_151815.json'
OUTPUT_FILE = Path('data') / 'initial_code_embeddings.json'
CONFIG_FILE = Path('config.json')
MODEL = "text-embedding-3-small"

# Load OpenAI API key
with open(CONFIG_FILE, 'r') as f:
    config = json.load(f)

client = OpenAI(api_key=config['api_key'])

def get_embedding(text, model=MODEL):
    """Get embedding for a text string"""
    try:
        text = text.replace("\n", " ").strip()
        response = client.embeddings.create(
            input=[text], 
            model=model
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error getting embedding for text: {e}")
        return None

def load_initial_codes():
    """Load and extract all initial codes from the dataset"""
    logger.info("Loading initial codes from dataset...")
    
    with open(DATA_FILE, 'r', encoding='utf8') as f:
        data = json.load(f)
    
    # Extract all initial codes with their case IDs
    code_to_cases = {}
    cases_with_codes = 0
    
    for case_id, case_data in data.items():
        if 'initial_code_0' in case_data:
            initial_code = case_data['initial_code_0']
            if initial_code not in code_to_cases:
                code_to_cases[initial_code] = []
            code_to_cases[initial_code].append(case_id)
            cases_with_codes += 1
    
    logger.info(f"Found {len(code_to_cases)} unique initial codes from {cases_with_codes} cases")
    return code_to_cases

def generate_embeddings(code_to_cases):
    """Generate embeddings for all unique initial codes"""
    logger.info(f"Generating embeddings for {len(code_to_cases)} unique codes...")
    
    embeddings_data = {}
    total_codes = len(code_to_cases)
    processed = 0
    
    for initial_code, case_ids in code_to_cases.items():
        processed += 1
        
        if processed % 10 == 0:
            logger.info(f"Processing code {processed}/{total_codes}")
        
        # Generate embedding
        embedding = get_embedding(initial_code)
        
        if embedding is not None:
            embeddings_data[initial_code] = {
                'embedding': embedding,
                'case_ids': case_ids,
                'frequency': len(case_ids),
                'dimension': len(embedding)
            }
            logger.debug(f"✅ Generated embedding for: '{initial_code[:50]}{'...' if len(initial_code) > 50 else ''}'")
        else:
            logger.error(f"❌ Failed to generate embedding for: '{initial_code[:50]}{'...' if len(initial_code) > 50 else ''}'")
        
        # Small delay to respect rate limits
        time.sleep(0.1)
    
    successful_embeddings = len([v for v in embeddings_data.values() if v['embedding'] is not None])
    logger.info(f"Successfully generated {successful_embeddings}/{total_codes} embeddings")
    
    return embeddings_data

def save_embeddings(embeddings_data):
    """Save embeddings to JSON file"""
    logger.info(f"Saving embeddings to {OUTPUT_FILE}")
    
    # Add metadata
    output_data = {
        'metadata': {
            'model': MODEL,
            'total_codes': len(embeddings_data),
            'embedding_dimension': embeddings_data[list(embeddings_data.keys())[0]]['dimension'] if embeddings_data else 0,
            'generated_at': time.strftime('%Y-%m-%d %H:%M:%S')
        },
        'embeddings': embeddings_data
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    logger.info("✅ Embeddings saved successfully")

def analyze_code_statistics(code_to_cases):
    """Analyze statistics about the initial codes"""
    logger.info("\n=== INITIAL CODE STATISTICS ===")
    
    # Frequency distribution
    frequencies = [len(case_ids) for case_ids in code_to_cases.values()]
    freq_counter = Counter(frequencies)
    
    logger.info(f"Total unique codes: {len(code_to_cases)}")
    logger.info(f"Total code assignments: {sum(frequencies)}")
    logger.info(f"Average frequency per code: {sum(frequencies) / len(code_to_cases):.2f}")
    logger.info(f"Most frequent code appears: {max(frequencies)} times")
    logger.info(f"Codes appearing only once: {freq_counter[1]}")
    
    # Show most frequent codes
    logger.info("\n=== TOP 10 MOST FREQUENT CODES ===")
    sorted_codes = sorted(code_to_cases.items(), key=lambda x: len(x[1]), reverse=True)
    for i, (code, case_ids) in enumerate(sorted_codes[:10]):
        logger.info(f"{i+1:2d}. ({len(case_ids):2d} cases) {code[:80]}{'...' if len(code) > 80 else ''}")

def main():
    logger.info("=== Starting Initial Code Embedding Generation ===")
    
    # Check if embeddings already exist
    if OUTPUT_FILE.exists():
        logger.info(f"Embeddings file {OUTPUT_FILE} already exists.")
        response = input("Do you want to regenerate embeddings? (y/N): ")
        if response.lower() != 'y':
            logger.info("Skipping embedding generation.")
            return
    
    # Load initial codes
    code_to_cases = load_initial_codes()
    
    if not code_to_cases:
        logger.error("No initial codes found. Run analysis_p2.py first.")
        return
    
    # Analyze statistics
    analyze_code_statistics(code_to_cases)
    
    # Generate embeddings
    embeddings_data = generate_embeddings(code_to_cases)
    
    # Save results
    save_embeddings(embeddings_data)
    
    logger.info("=== Embedding Generation Complete ===")
    logger.info(f"Results saved to: {OUTPUT_FILE}")
    logger.info("You can now use these embeddings for:")
    logger.info("- Clustering similar codes")
    logger.info("- Finding semantic similarities")
    logger.info("- Validating theme assignments")
    logger.info("- Anomaly detection")

if __name__ == "__main__":
    main() 