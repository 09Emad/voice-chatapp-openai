const { useState, useEffect, useRef } = React;

const statusLabels = {
  ready: "جاهز",
  recording: "جارٍ التسجيل",
  processing: "جارٍ المعالجة",
  loading: "جارٍ التحميل",
  offline: "غير متصل",
  error: "حدث خطأ",
};

const App = () => {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [voice, setVoice] = useState("default");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const clearError = () => setError("");

  const loadModels = async () => {
    setStatus("loading");
    try {
      const response = await fetch("/health");
      if (!response.ok) {
        throw new Error("تعذر تحميل حالة الخادم.");
      }
      const data = await response.json();
      if (!Array.isArray(data.supported_models) || data.supported_models.length === 0) {
        throw new Error("لا يوجد موديلات متاحة.");
      }
      setModels(data.supported_models);
      setSelectedModel(data.supported_models[0] || "gpt-5-nano");
      setStatus("ready");
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل الموديلات.");
      setStatus("offline");
    }
  };

  const appendMessage = (message) => {
    const timestamp = new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setMessages((prev) => [...prev, { ...message, createdAt: timestamp }]);
  };

  const playAudio = (src) => {
    if (!src) return;
    const audio = new Audio(src);
    audio.play().catch(() => {
      setError("فشل تشغيل الصوت.");
    });
  };

  const handleTextSubmit = async () => {
    const text = inputValue.trim();
    if (!text) {
      setError("الرجاء كتابة رسالة أو الضغط على الميكروفون للتسجيل الصوتي.");
      return;
    }
    clearError();
    setInputValue("");
    await sendMessage(text, null);
  };

  const sendMessage = async (text, audioUrl) => {
    appendMessage({ role: "user", text, audioUrl });
    setIsLoading(true);
    setStatus("processing");
    try {
      const response = await fetch("/process-message", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: text, voice, modelName: selectedModel }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "تعذر معالجة الرسالة.");
      }
      const botAudioUrl = `data:audio/wav;base64,${payload.openaiResponseSpeech}`;
      appendMessage({ role: "assistant", text: payload.openaiResponseText, audioUrl: botAudioUrl });
      setStatus("ready");
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء معالجة الرسالة.");
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!isLoading) {
        handleTextSubmit();
      }
    }
  };

  const startRecording = async () => {
    clearError();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("الميكروفون غير مدعوم في هذا المتصفح.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(blob);
        setRecording(false);
        recorderRef.current = null;
        streamRef.current = null;
        setStatus("processing");

        try {
          const text = await speechToText(blob);
          await sendMessage(text, audioUrl);
        } catch (err) {
          setError(err.message || "فشل تحويل الصوت إلى نص.");
          setStatus("error");
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      streamRef.current = stream;
      setRecording(true);
      setStatus("recording");
    } catch (err) {
      setError("يرجى السماح بالوصول إلى الميكروفون.");
      setStatus("error");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const speechToText = async (blob) => {
    const response = await fetch("/speech-to-text", {
      method: "POST",
      body: blob,
    });
    const payload = await response.json();
    if (!response.ok || !payload.text) {
      throw new Error(payload.error || "فشل تحويل الصوت إلى نص.");
    }
    return payload.text;
  };

  const statusClass = () => {
    if (status === "ready") return "status-online";
    if (status === "recording") return "status-recording";
    if (status === "processing") return "status-processing";
    if (status === "offline") return "status-offline";
    return "status-error";
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-icon"></span>
          <div>
            <p className="brand-title">Voice Assistant Studio</p>
            <p className="brand-subtitle">مساعدك الصوتي الذكي</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className={`status-pill ${statusClass()}`}>{statusLabels[status] || "غير متصل"}</span>
          <button className="theme-toggle" type="button" onClick={() => setDarkMode((current) => !current)}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <section className="control-panel">
        <div className="control-card">
          <div className="card-label">الموديل</div>
          <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={isLoading || !models.length}>
            {models.length === 0 ? (
              <option>تحميل...</option>
            ) : (
              models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="control-card">
          <div className="card-label">نبرة الصوت</div>
          <select value={voice} onChange={(event) => setVoice(event.target.value)} disabled={isLoading}>
            <option value="default">التلقائي</option>
            <option value="en-US_MichaelV3Voice">Michael</option>
            <option value="en-US_HenryV3Voice">Henry</option>
            <option value="en-GB_KateV3Voice">Kate</option>
            <option value="en-GB_JamesV3Voice">James</option>
            <option value="en-GB_CharlotteV3Voice">Charlotte</option>
            <option value="en-US_LisaV3Voice">Lisa</option>
            <option value="en-US_KevinV3Voice">Kevin</option>
            <option value="en-US_EmilyV3Voice">Emily</option>
            <option value="en-US_AllisonV3Voice">Allison</option>
            <option value="en-US_OliviaV3Voice">Olivia</option>
          </select>
        </div>
      </section>

      <section className="stats-row">
        <div className="stats-card">
          <div className="stats-icon">💬</div>
          <div>
            <p>عدد الرسائل</p>
            <strong>{messages.length}</strong>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon">⏱️</div>
          <div>
            <p>زمن الاستجابة</p>
            <strong>1.2s</strong>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon">✅</div>
          <div>
            <p>الحالة</p>
            <strong>ممتاز</strong>
          </div>
        </div>
      </section>

      <section className="quick-actions">
        <div className="quick-card">اقتراحات ذكية</div>
        <div className="quick-card">كيف يمكنني المساعدة</div>
        <div className="quick-card">اشرح موضوع</div>
        <div className="quick-card">تجربة صوتية</div>
      </section>

      <section className="chat-card">
        <div className="chat-card-header">
          <div>
            <h2>المحادثة</h2>
            <p>اكتب رسالة أو سجّل صوتك ثم استقبل رد الذكاء الاصطناعي.</p>
          </div>
          <span className="chat-tag">{selectedModel || "gpt-5-nano"}</span>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="chat-window">
          {messages.length === 0 ? (
            <div className="message-row assistant">
              <div className="bubble">
                <p>أهلاً بك! أنا هنا لمساعدتك صوتياً. اكتب رسالة أو اضغط على الميكروفون للبدء.</p>
                <div className="bubble-meta">
                  <span>الآن</span>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`message-row ${message.role === "user" ? "user" : "assistant"}`}>
                <div className="bubble">
                  <p>{message.text}</p>
                  <div className="bubble-meta">
                    <span>{message.createdAt}</span>
                    {message.audioUrl && (
                      <button className="play-btn" type="button" onClick={() => playAudio(message.audioUrl)}>
                        تشغيل
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="chat-footer">
          <input
            type="text"
            className="chat-input"
            placeholder="اكتب رسالتك هنا..."
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className={`footer-button mic ${recording ? "recording" : ""}`}
            type="button"
            onClick={toggleRecording}
            disabled={isLoading && !recording}
            aria-label={recording ? "إيقاف التسجيل" : "بدء التسجيل"}
          >
            {recording ? "⏹️" : "🎤"}
          </button>
          <button
            className="footer-button send"
            type="button"
            onClick={handleTextSubmit}
            disabled={isLoading || !inputValue.trim()}
            aria-label="إرسال الرسالة"
          >
            ✈️
          </button>
        </div>
      </section>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
