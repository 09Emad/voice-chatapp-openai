import os

import requests
from openai import OpenAI

openai_client = OpenAI()

WATSON_BASE_URL = "https://sn-watson-stt.labs.skills.network"
DEFAULT_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-nano")


def speech_to_text(audio_binary):
    api_url = f"{WATSON_BASE_URL}/speech-to-text/api/v1/recognize"
    params = {"model": "en-US_Multimedia"}

    response = requests.post(api_url, params=params, data=audio_binary, timeout=60)
    response.raise_for_status()
    payload = response.json()

    results = payload.get("results") or []
    if not results:
        return ""

    alternatives = results[-1].get("alternatives") or []
    if not alternatives:
        return ""

    return alternatives[-1].get("transcript", "").strip()


def text_to_speech(text, voice="default"):
    api_url = f"{WATSON_BASE_URL}/text-to-speech/api/v1/synthesize?output=output_text.wav"

    if voice and voice != "default":
        api_url += f"&voice={voice}"

    headers = {
        "Accept": "audio/wav",
        "Content-Type": "application/json",
    }

    response = requests.post(api_url, headers=headers, json={"text": text}, timeout=60)
    response.raise_for_status()
    return response.content


def openai_process_message(user_message, model_name=None):
    prompt = (
        "Act like a personal assistant. You can respond to questions, translate sentences, "
        "summarize news, and give recommendations. Keep responses concise and helpful."
    )

    selected_model = model_name or DEFAULT_OPENAI_MODEL
    openai_response = openai_client.chat.completions.create(
        model=selected_model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_message},
        ],
        max_completion_tokens=600,
    )

    return openai_response.choices[0].message.content.strip()


