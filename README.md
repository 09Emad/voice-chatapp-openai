# Voice Assistant Studio

A polished voice assistant built with Flask, OpenAI, speech-to-text, and text-to-speech. The app supports typed and spoken input, multiple OpenAI models, voice selection, and a modern chat interface.

## Highlights

- Voice input with browser recording
- Speech-to-text and text-to-speech integration
- Multiple OpenAI models selectable from the UI
- Clean dark/light experience
- Better input validation and error handling
- `/health` endpoint for quick verification

## Architecture

- `server.py` exposes Flask routes and request validation.
- `worker.py` wraps OpenAI, STT, and TTS calls.
- `templates/index.html` defines the application shell.
- `static/script.js` handles recording, model selection, and chat flow.
- `static/style.css` provides the visual system and responsive layout.

## Supported Models

- `gpt-5-nano`
- `gpt-5-mini`
- `gpt-4.1-mini`

## Setup

```bash
pip install -r requirements.txt
```

Set your OpenAI key before running. On Windows PowerShell:

```powershell
setx OPENAI_API_KEY "your_key_here"
```

Then close and reopen PowerShell, or set it for the current session with:

```powershell
$env:OPENAI_API_KEY = "your_key_here"
```

## Run

```bash
python server.py
```

Open:

```text
http://127.0.0.1:8000
```

## Endpoints

- `GET /`
- `GET /health`
- `POST /speech-to-text`
- `POST /process-message`

## Environment Variables

- `OPENAI_MODEL` - default model used by the backend
- `PORT` - Flask port, default `8000`
- `FLASK_DEBUG` - set to `1` for local debugging

## Notes

- The app requires network access for OpenAI and Watson API calls.
- If the microphone button does not work, the browser likely needs microphone permission.
- The selected model is sent with each request, so you can compare responses without changing code.
