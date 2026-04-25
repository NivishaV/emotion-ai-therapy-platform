from modules.ollama_client import generate_reply
from modules.text_emotion import detect_text_emotion
from modules.face_client import get_latest_face_state
from modules.fusion import fuse_modalities

conversation_memory = {}

SYSTEM_PROMPT = (
    "You are a professional and empathetic AI therapist. "
    "Keep responses short, natural, supportive, and human-like. "
    "Reply in 2 to 4 short sentences only. "
    "Do not give long essays. "
    "Remember the conversation context and respond accordingly. "
    "If the user seems distressed, be calm and reassuring. "
    "If the user appears distracted or off-center, gently encourage focus."
)

def get_or_create_memory(user_id: str):
    if user_id not in conversation_memory:
        conversation_memory[user_id] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
    return conversation_memory[user_id]

def process_fused_message(user_id: str, user_message: str, source: str = "text"):
    text_result = detect_text_emotion(user_message)
    text_emotion = text_result["label"]

    face_state = get_latest_face_state()

    fusion_result = fuse_modalities(text_emotion, face_state, source)

    memory = get_or_create_memory(user_id)

    fused_context = (
        f"[Source: {source}] "
        f"[Text emotion: {text_emotion}] "
        f"[Face detected: {fusion_result['face_detected']}] "
        f"[Face emotion: {fusion_result['face_emotion']}] "
        f"[Final fused emotion: {fusion_result['final_emotion']}] "
        f"[Distraction: {fusion_result['distraction']}] "
        f"[Centered: {fusion_result['centered']}] "
        f"{user_message}"
    )

    memory.append({
        "role": "user",
        "content": fused_context
    })

    reply = generate_reply(memory)

    memory.append({
        "role": "assistant",
        "content": reply
    })

    return {
        "source": source,
        "text": user_message,
        "text_emotion": text_emotion,
        "face_emotion": fusion_result["face_emotion"],
        "face_detected": fusion_result["face_detected"],
        "final_emotion": fusion_result["final_emotion"],
        "distraction": fusion_result["distraction"],
        "centered": fusion_result["centered"],
        "response": reply
    }