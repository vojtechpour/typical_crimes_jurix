import sys
import json
import os
import anthropic
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the project root to path
sys.path.append('/Users/vojtechpour/projects/typical-crimes')

# Load API key from config
with open('/Users/vojtechpour/projects/typical-crimes/config.json') as f:
    config = json.load(f)
    api_key = config.get('anthropic_api_key')
    if not api_key:
        raise ValueError("anthropic_api_key not found in config.json")

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=api_key)

MODEL = 'claude-3-5-sonnet-20241022'  # Use Claude 3.5 Sonnet
COMPLETION_LEN = 4000

def get_analysis(system_prompt, user_prompt):
    logger.info(f"Sending request to Claude API for theme suggestions")
    
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=COMPLETION_LEN,
            temperature=0.7,  # Slightly lower temperature for more consistent JSON
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        
        # Create compatibility response format
        response_dict = {
            'system_prompt': system_prompt,
            'user_prompt': user_prompt,
            'params': {
                'temperature': 0.7,
                'max_tokens': COMPLETION_LEN,
            },
            'choices': [{
                'message': {
                    'content': response.content[0].text
                }
            }],
            'usage': response.usage.__dict__
        }
        return response_dict
        
    except Exception as e:
        error_str = str(e).lower()
        if "rate limit" in error_str or "quota" in error_str:
            logger.warning('Rate limit error, sleeping for 1 minute ...')
            time.sleep(60)
            return get_analysis(system_prompt, user_prompt)
        else:
            raise e

def generate_theme_suggestions(prompt, theme_data):
    system_prompt = """You are an expert data analyst specializing in crime theme organization. 
Your task is to analyze crime theme structures and provide intelligent suggestions for improvement.
Always respond with valid JSON in the exact format requested. Do not include any text outside the JSON structure."""
    
    try:
        response = get_analysis(system_prompt, prompt)
        content = response['choices'][0]['message']['content']
        
        # Try to extract JSON from the response
        if '```json' in content:
            json_start = content.find('```json') + 7
            json_end = content.find('```', json_start)
            content = content[json_start:json_end].strip()
        elif content.strip().startswith('{'):
            content = content.strip()
        
        # Parse and validate JSON
        result = json.loads(content)
        return {"success": True, "content": content}
        
    except Exception as e:
        logger.error(f"Error generating theme suggestions: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    prompt = sys.argv[1]
    theme_data = json.loads(sys.argv[2])
    
    result = generate_theme_suggestions(prompt, theme_data)
    print(json.dumps(result)) 