import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "phi3:mini"

def generate_reply(messages):
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 90
        }
    }

    response = requests.post(OLLAMA_URL, json=payload, timeout=120)

    print("Ollama status:", response.status_code)
    print("Ollama body:", response.text)

    response.raise_for_status()
    data = response.json()
    return data["message"]["content"]