'''
There needs to be a config.json file in the same directory as this file with the
openai api key in it. The file should look like this:

{
    "api_key": "YOUR_KEY"
}
'''

import json
from openai import OpenAI
from time import sleep
import datetime


MODEL = 'gpt-4o'
TEMPERATURE = 1
COMPLETION_LEN = 2000
TOP_P = 1
FREQUENCY_PENALTY = 0
PRESENCE_PENALTY = 0


with open('config.json') as f:
    api_key = json.load(f)['api_key']
    client = OpenAI(api_key=api_key)
    
    
def get_analysis(system_prompt, user_prompt):
    response = get_response(system_prompt, user_prompt)
    # Store original prompts in response object for compatibility
    response_dict = {
        'system_prompt': system_prompt,
        'user_prompt': user_prompt,
        'params': {
            'temperature': TEMPERATURE,
            'max_tokens': COMPLETION_LEN,
            'top_p': TOP_P,
            'frequency_penalty': FREQUENCY_PENALTY,
            'presence_penalty': PRESENCE_PENALTY
        },
        'choices': [{
            'message': {
                'content': response.choices[0].message.content
            }
        }]
    }
    return response_dict


def get_response(system_prompt, user_prompt, attempt=0, limit=5):
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt}
    ]
    print(f"Sending request to OpenAI API at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    try:
        return client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=TEMPERATURE,
            max_tokens=COMPLETION_LEN,
            top_p=TOP_P,
            frequency_penalty=FREQUENCY_PENALTY,
            presence_penalty=PRESENCE_PENALTY
        )
    except Exception as e:
        if "rate limit" in str(e).lower():
            print('Rate limit error, sleeping for 1 minute ...')
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
    print(f"Response received from OpenAI API at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if isinstance(response, dict) and 'choices' in response:
        # Handle old format response
        plain_text = response['choices'][0]['message']['content'].strip()
    else:
        # Handle new format response
        plain_text = response.choices[0].message.content.strip()
    
    print(f"Raw response content: {plain_text[:100]}...")  # Print first 100 chars to avoid flooding console
    
    # Handle markdown code blocks
    if plain_text.startswith("```json") and "```" in plain_text[6:]:
        plain_text = plain_text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif plain_text.startswith("```") and "```" in plain_text[3:]:
        plain_text = plain_text.split("```", 1)[1].split("```", 1)[0].strip()
    
    # Add error handling for JSON parsing
    try:
        return json.loads(plain_text)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print(f"Full response content: {plain_text}")
        # Return empty dict as fallback to avoid crashes
        return {}
