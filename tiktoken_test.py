import json
from pathlib import Path
import tiktoken


DATA_DIR = Path('data')
DATA_FILE = DATA_DIR / 'kradeze_pripady.json'
DATA_FILE_OUT = DATA_DIR / 'kradeze_pripady.json'


def treat_dp_text(text, enc, limit=2000):
    enc_dp = enc.encode(text)
    if len(enc_dp) > limit:
        enc_dp_start = enc_dp[:(limit // 2)]
        enc_dp_end = enc_dp[-(limit // 2):]
        text = enc.decode(enc_dp_start) + '\n[...]\n' +  enc.decode(enc_dp_end)
    return text


encoding = tiktoken.encoding_for_model('gpt-4')
with open(DATA_FILE, 'r', encoding='utf8') as f:
    data = json.load(f)
for id, dp in data.items():
    dp['plny_skutek_short'] = treat_dp_text(dp['plny_skutek'], encoding, 2000)

with open(DATA_FILE_OUT, 'w', encoding='utf8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)