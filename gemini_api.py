'''
There needs to be a config.json file in the same directory as this file with the
Google API key in it. The file should look like this:

{
    "gemini_api_key": "YOUR_GEMINI_API_KEY"
}
'''

import json
import google.generativeai as genai
from time import sleep
import datetime
import logging

# Set up logging for this module
logger = logging.getLogger(__name__)

MODEL = 'gemini-2.0-flash'
TEMPERATURE = 1
COMPLETION_LEN = 2000
TOP_P = 1


with open('config.json') as f:
    config = json.load(f)
    api_key = config.get('gemini_api_key') or config.get('api_key')  # Fallback to api_key for compatibility
    genai.configure(api_key=api_key)


def count_tokens(text, model_name=MODEL, max_retries=3):
    """Count tokens using Gemini's native token counting with robust error handling"""
    if not text or not text.strip():
        return 0
    
    # Use simple estimation for very short texts to avoid API calls
    if len(text) < 20:
        return max(1, len(text) // 4)
    
    for attempt in range(max_retries):
        try:
            logger.debug(f"Counting tokens for text of length {len(text)} (attempt {attempt + 1})")
            model = genai.GenerativeModel(model_name)
            response = model.count_tokens(text)
            logger.debug(f"Token count successful: {response.total_tokens}")
            return response.total_tokens
            
        except Exception as e:
            error_str = str(e).lower()
            logger.warning(f"Token counting attempt {attempt + 1} failed: {e}")
            
            if "quota" in error_str or "rate limit" in error_str:
                wait_time = (attempt + 1) * 30  # Progressive backoff
                logger.info(f"Rate limit hit, waiting {wait_time} seconds...")
                sleep(wait_time)
                continue
            elif attempt < max_retries - 1:
                sleep(2)  # Short wait for other errors
                continue
            else:
                logger.warning(f"All token counting attempts failed, using fallback estimation")
                # Fallback to character-based estimation: 1 token ≈ 4 characters for Gemini
                estimated_tokens = max(1, len(text) // 4)
                logger.debug(f"Fallback estimation: {estimated_tokens} tokens for {len(text)} characters")
                return estimated_tokens
    
    # Final fallback
    return max(1, len(text) // 4)


def get_analysis(system_prompt, user_prompt):
    response = get_response(system_prompt, user_prompt)
    
    # Check if response was blocked or incomplete
    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'finish_reason'):
            finish_reason = candidate.finish_reason
            # finish_reason values: 1=STOP (normal), 2=SAFETY, 3=RECITATION, 4=OTHER
            if finish_reason == 2:  # SAFETY
                logger.error("Response blocked due to safety filters")
                raise Exception("Response blocked by Gemini safety filters. Try reducing batch size or content.")
            elif finish_reason == 3:  # RECITATION
                logger.error("Response blocked due to recitation concerns")
                raise Exception("Response blocked due to recitation concerns")
            elif finish_reason == 4:  # OTHER
                logger.error("Response blocked for other reasons")
                raise Exception("Response blocked for unknown reasons")
    
    # Check if response has valid content
    try:
        content = response.text
    except Exception as e:
        logger.error(f"Cannot access response.text: {e}")
        raise Exception(f"Invalid response from Gemini: {e}")
    
    # Store original prompts in response object for compatibility with existing code
    response_dict = {
        'system_prompt': system_prompt,
        'user_prompt': user_prompt,
        'params': {
            'temperature': TEMPERATURE,
            'max_tokens': COMPLETION_LEN,
            'top_p': TOP_P,
        },
        'choices': [{
            'message': {
                'content': content
            }
        }]
    }
    return response_dict


def get_response(system_prompt, user_prompt, attempt=0, limit=5):
    logger.info(f"Sending request to Gemini API at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Configure less restrictive safety settings for crime data analysis
    safety_settings = [
        {
            "category": "HARM_CATEGORY_HARASSMENT",
            "threshold": "BLOCK_NONE"  # Allow all harassment content (crime reports may contain this)
        },
        {
            "category": "HARM_CATEGORY_HATE_SPEECH", 
            "threshold": "BLOCK_NONE"  # Allow all hate speech content for research
        },
        {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "threshold": "BLOCK_NONE"  # Allow all explicit content for research
        },
        {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "threshold": "BLOCK_NONE"  # Allow dangerous content (crime reports contain this)
        }
    ]
    
    try:
        # Initialize the model with system instruction and safety settings
        model = genai.GenerativeModel(
            model_name=MODEL,
            system_instruction=system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=TEMPERATURE,
                max_output_tokens=COMPLETION_LEN,
                top_p=TOP_P,
            ),
            safety_settings=safety_settings
        )
        
        # Generate content with user prompt
        response = model.generate_content(user_prompt)
        return response
        
    except Exception as e:
        error_str = str(e).lower()
        if "quota" in error_str or "rate limit" in error_str or "resource_exhausted" in error_str:
            logger.warning('Rate limit/quota error, sleeping for 1 minute ...')
            sleep(60)
            if attempt >= limit:
                raise Exception(
                    f'Abandoning the quest after {attempt} futile attempts due to '
                    f'rate limit error.'
                )
            return get_response(system_prompt, user_prompt, attempt=attempt+1, limit=limit)
        else:
            raise e


def response_to_json(response):
    logger.info(f"Response received from Gemini API at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if isinstance(response, dict) and 'choices' in response:
        # Handle compatibility format response
        plain_text = response['choices'][0]['message']['content'].strip()
    else:
        # Handle Gemini response format
        plain_text = response.text.strip()
    
    logger.debug(f"Raw response content: {plain_text[:100]}...")  # Print first 100 chars to avoid flooding console
    
    # Handle markdown code blocks
    if plain_text.startswith("```json") and "```" in plain_text[6:]:
        plain_text = plain_text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif plain_text.startswith("```") and "```" in plain_text[3:]:
        plain_text = plain_text.split("```", 1)[1].split("```", 1)[0].strip()
    
    # Add error handling for JSON parsing
    try:
        return json.loads(plain_text)
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON: {e}")
        logger.error(f"Full response content: {plain_text}")
        # Return empty dict as fallback to avoid crashes
        return {} 