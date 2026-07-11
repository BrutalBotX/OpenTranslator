import sys, json, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
data = json.loads(urllib.request.urlopen('http://127.0.0.1:8712/api/settings').read())
providers = data['meta']['primary_provider']['options']
print(f'Providers count: {len(providers)}')
print(f'Has opencode: {"opencode" in providers}')
print(f'First 5: {providers[:5]}')
models = json.loads(urllib.request.urlopen('http://127.0.0.1:8712/api/settings/models?provider=openai&api_key=test').read())
print(f'Models fetch: count={len(models["models"])}, error={models.get("error", "none")}')
