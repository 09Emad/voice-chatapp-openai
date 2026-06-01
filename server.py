import base64
import os

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

from worker import DEFAULT_OPENAI_MODEL, openai_process_message, speech_to_text, text_to_speech


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

SUPPORTED_MODELS = [
    {
        "id": "gpt-5-nano",
        "label": "GPT-5 Nano",
        "description": "Fast and lightweight for short assistant replies.",
    },
    {
        "id": "gpt-5-mini",
        "label": "GPT-5 Mini",
        "description": "Balanced for better writing and reasoning.",
    },
    {
        "id": "gpt-4.1-mini",
        "label": "GPT-4.1 Mini",
        "description": "Strong general-purpose model for the demo.",
    },
]


@app.route("/", methods=["GET"])
def index():
    return render_template(
        "index.html",
        default_model=DEFAULT_OPENAI_MODEL,
        supported_models=SUPPORTED_MODELS,
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "default_model": DEFAULT_OPENAI_MODEL,
            "supported_models": [model["id"] for model in SUPPORTED_MODELS],
        }
    )


@app.route("/speech-to-text", methods=["POST"])
def speech_to_text_route():
    audio_binary = request.data
    if not audio_binary:
        return jsonify({"error": "audio payload is required"}), 400

    try:
        text = speech_to_text(audio_binary)
        return jsonify({"text": text})
    except Exception as exc:
        return jsonify({"error": f"speech-to-text failed: {exc}"}), 502


def format_openai_error(exc):
    message = str(exc)
    if "Incorrect API key provided" in message or "invalid_api_key" in message:
        return "مفتاح OpenAI غير صالح. عيّن OPENAI_API_KEY إلى مفتاحك الحقيقي."
    if "Missing OpenAI API key" in message or "OPENAI_API_KEY" in message:
        return "مفتاح OpenAI مفقود. عيّن OPENAI_API_KEY إلى مفتاحك الحقيقي."
    return message


@app.route("/process-message", methods=["POST"])
def process_message_route():
    payload = request.get_json(silent=True) or {}
    user_message = (payload.get("userMessage") or "").strip()
    voice = payload.get("voice", "default")
    model_name = payload.get("modelName") or DEFAULT_OPENAI_MODEL

    if not user_message:
        return jsonify({"error": "userMessage is required"}), 400

    if model_name not in {model["id"] for model in SUPPORTED_MODELS}:
        return jsonify({"error": "unsupported model"}), 400

    try:
        openai_response_text = openai_process_message(user_message, model_name=model_name)
        openai_response_text = os.linesep.join(
            [line for line in openai_response_text.splitlines() if line]
        ).strip()
        openai_response_speech = text_to_speech(openai_response_text, voice)
        openai_response_speech = base64.b64encode(openai_response_speech).decode("utf-8")
    except Exception as exc:
        error_message = format_openai_error(exc)
        return jsonify({"error": f"processing failed: {error_message}"}), 502

    return jsonify(
        {
            "openaiResponseText": openai_response_text,
            "openaiResponseSpeech": openai_response_speech,
            "modelName": model_name,
        }
    )


if __name__ == "__main__":
    app.run(
        port=int(os.getenv("PORT", "8000")),
        host="0.0.0.0",
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
