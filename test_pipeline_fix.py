import sys, json, urllib.request, time
sys.stdout.reconfigure(encoding='utf-8')
BASE = 'http://127.0.0.1:8712/api'

def get(path):
    return json.loads(urllib.request.urlopen(f'{BASE}{path}').read())

def put(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f'{BASE}{path}', data=data, method='PUT', headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req)

# 1. Check cache loaded at startup
s = get('/settings')
print(f'1. Startup: provider={s["values"]["primary_provider"]} model={s["values"]["primary_model"]}')

# 2. Save openai without model (simulates user picking provider but not model)
put('/settings', {'values': {'primary_provider': 'openai', 'primary_model': '', 'primary_api_key': 'sk-test'}})

# 3. Check llm-config — model should default to gpt-4o
cfg = get('/settings/llm-config')
print(f'2. LLM config: provider={cfg["primary"]["provider"]} model={cfg["primary"]["model"]}')
assert cfg['primary']['model'] == 'gpt-4o', f'Expected gpt-4o, got {cfg["primary"]["model"]}'
print('3. Model correctly defaulted to gpt-4o')

# 4. Save with explicit model
put('/settings', {'values': {'primary_provider': 'openai', 'primary_model': 'gpt-4-turbo', 'primary_api_key': 'sk-test'}})
cfg2 = get('/settings/llm-config')
print(f'4. Custom model: {cfg2["primary"]["model"]}')
assert cfg2['primary']['model'] == 'gpt-4-turbo'
print('5. Custom model respected')

print('\nAll assertions passed')
