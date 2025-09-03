import sys
import json
import os
import anthropic
import time
import logging
from openai import OpenAI

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the project root to path
sys.path.append('/Users/vojtechpour/projects/typical-crimes')

# Load API keys from config
with open('/Users/vojtechpour/projects/typical-crimes/config.json') as f:
    config = json.load(f)
    anthropic_api_key = config.get('anthropic_api_key')
    openai_api_key = config.get('api_key') or config.get('openai_api_key')

# Initialize clients lazily when needed to allow optional providers
anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key) if anthropic_api_key else None
openai_client = OpenAI(api_key=openai_api_key) if openai_api_key else None

MODEL = 'claude-3-5-sonnet-20241022'  # Default Claude model
COMPLETION_LEN = 4000

def get_analysis(system_prompt, user_prompt, settings=None):
    """Call the selected provider (OpenAI GPT-5 via Responses API or Anthropic Claude).

    Returns a compatibility dict with a 'choices[0].message.content' string.
    """
    provider = (settings or {}).get('provider')
    use_gpt5 = (settings or {}).get('useGpt5')

    # Prefer explicit provider selection; otherwise use GPT-5 if requested
    if provider == 'openai' or use_gpt5:
        if not openai_client:
            raise ValueError("OpenAI API key not configured in config.json (api_key)")

        model = (settings or {}).get('model') or 'gpt-5'
        reasoning_effort = (settings or {}).get('reasoningEffort')
        verbosity = (settings or {}).get('verbosity')

        logger.info(f"Sending request to OpenAI GPT-5 ({model}) via Responses API")

        # Build input as a list of messages so we can include system + user
        input_list = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        kwargs = {
            'model': model,
            'input': input_list,
        }
        if reasoning_effort:
            kwargs['reasoning'] = {'effort': reasoning_effort}
        if verbosity:
            kwargs['text'] = {'verbosity': verbosity}

        try:
            response = openai_client.responses.create(**kwargs)
            content_text = response.output_text

            response_dict = {
                'system_prompt': system_prompt,
                'user_prompt': user_prompt,
                'params': {
                    'model': model,
                    'reasoning_effort': reasoning_effort,
                    'verbosity': verbosity,
                },
                'choices': [{
                    'message': {
                        'content': content_text
                    }
                }]
            }
            return response_dict
        except Exception as e:
            error_str = str(e).lower()
            if "rate limit" in error_str or "quota" in error_str:
                logger.warning('OpenAI rate limit/quota error, sleeping for 1 minute ...')
                time.sleep(60)
                return get_analysis(system_prompt, user_prompt, settings=settings)
            else:
                raise e

    # Default to Anthropic Claude
    if not anthropic_client:
        raise ValueError("anthropic_api_key not found in config.json")

    logger.info(f"Sending request to Claude API for theme suggestions")

    try:
        response = anthropic_client.messages.create(
            model=MODEL,
            max_tokens=COMPLETION_LEN,
            temperature=0.7,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )

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
            return get_analysis(system_prompt, user_prompt, settings=settings)
        else:
            raise e

def generate_theme_suggestions(prompt, theme_data, settings=None):
    system_prompt = """You are an expert data analyst specializing in crime theme organization. 
Your task is to analyze crime theme structures and provide intelligent suggestions for improvement.
Always respond with valid JSON in the exact format requested. Do not include any text outside the JSON structure."""
    
    try:
        response = get_analysis(system_prompt, prompt, settings=settings)
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
    settings = None
    if len(sys.argv) > 3:
        try:
            settings = json.loads(sys.argv[3])
        except Exception:
            settings = None
    
    result = generate_theme_suggestions(prompt, theme_data, settings=settings)
    print(json.dumps(result))