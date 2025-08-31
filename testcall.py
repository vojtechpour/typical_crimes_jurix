import requests

# API endpoint configuration
api_url = 'https://ai.ufal.mff.cuni.cz/api/chat/completions'
api_key = 'sk-bd1621885fd3482ba37a1423cefb342d'

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

data = {
    'model': 'LLM1-A40.llama3.3:latest',
    'messages': [{
        'role': 'user',
        'content': 'What is the capital city of France?'
    }],
    'stream': False,
    'options': {
        'ctx_size': 4500
    }
}

response = requests.post(api_url, headers=headers, json=data)

if response.status_code == 200:
    result = response.json()
    print('Generated text:', result.get('choices', [{}])[0].get('message', {}).get('content', ''))
else:
    print(f"Request failed: {response.status_code}, {response.text}")