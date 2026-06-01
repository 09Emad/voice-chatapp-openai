let recorder = null;
let recording = false;
let voiceOption = "default";
let selectedModel = "";
let lightMode = true;

const responses = [];
const botRepeatButtonIDToIndexMap = {};
const userRepeatButtonIDToRecordingMap = {};
const baseUrl = window.location.origin;
const errorBanner = $("#error-banner");
const sendButton = $("#send-button");

async function showBotLoadingAnimation() {
  await sleep(200);
  $(".loading-animation")[1].style.display = "inline-block";
}

function hideBotLoadingAnimation() {
  $(".loading-animation")[1].style.display = "none";
}

async function showUserLoadingAnimation() {
  await sleep(100);
  $(".loading-animation")[0].style.display = "flex";
}

function hideUserLoadingAnimation() {
  $(".loading-animation")[0].style.display = "none";
}

const setConnectionStatus = (text) => {
  $("#connection-status").text(text);
};

const showError = (message) => {
  errorBanner.text(message);
  errorBanner.removeClass("hidden");
  setConnectionStatus("error");
};

const hideError = () => {
  errorBanner.addClass("hidden");
};

const setLoadingState = (isLoading) => {
  sendButton.prop("disabled", isLoading);
  $("#message-input").prop("disabled", isLoading);
  $("#model-options").prop("disabled", isLoading);
  $("#voice-options").prop("disabled", isLoading);
};

const getSpeechToText = async (userRecording) => {
  const response = await fetch(baseUrl + "/speech-to-text", {
    method: "POST",
    body: userRecording.audioBlob,
  });
  const payload = await response.json();
  if (!payload.text) {
    throw new Error(payload.error || "Speech recognition failed.");
  }
  return payload.text;
};

const processUserMessage = async (userMessage) => {
  const response = await fetch(baseUrl + "/process-message", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      userMessage: userMessage,
      voice: voiceOption,
      modelName: selectedModel,
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "AI processing failed.");
  }
  if (!payload.openaiResponseText || !payload.openaiResponseSpeech) {
    throw new Error("Incomplete response from server.");
  }
  return payload;
};

const cleanTextInput = (value) => {
  return value
    .trim()
    .replace(/[\n\t]/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&;]/g, "");
};

const recordAudio = () => {
  return new Promise(async (resolve, reject) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return reject(new Error("Microphone access is not supported by this browser."));
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      return reject(new Error("Microphone permission is required to record audio."));
    }

    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
      audioChunks.push(event.data);
    });

    const start = () => mediaRecorder.start();

    const stop = () =>
      new Promise((resolve) => {
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          resolve({
            audioBlob,
            audioUrl,
            play: () => audio.play(),
          });
        });

        mediaRecorder.stop();
      });

    resolve({ start, stop });
  });
};

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

const toggleRecording = async () => {
  if (!recording) {
    try {
      recorder = await recordAudio();
      recording = true;
      recorder.start();
      setConnectionStatus("recording");
      hideError();
      return null;
    } catch (err) {
      showError(err.message || "Unable to access your microphone.");
      return null;
    }
  }

  try {
    const audio = await recorder.stop();
    recording = false;
    setConnectionStatus("processing");
    return audio;
  } catch (err) {
    recording = false;
    showError(err.message || "Unable to stop recording.");
    return null;
  }
};

const playResponseAudio = (function () {
  const df = document.createDocumentFragment();
  return function Sound(src) {
    const snd = new Audio(src);
    df.appendChild(snd);
    snd.addEventListener("ended", function () {
      df.removeChild(snd);
    });
    snd.play();
    return snd;
  };
})();

const getRandomID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const scrollToBottom = () => {
  $("#chat-window").animate({
    scrollTop: $("#chat-window")[0].scrollHeight,
  });
};

const populateUserMessage = (userMessage, userRecording) => {
  $("#message-input").val("");

  if (userRecording) {
    const userRepeatButtonID = getRandomID();
    userRepeatButtonIDToRecordingMap[userRepeatButtonID] = userRecording;
    hideUserLoadingAnimation();
    $("#message-list").append(
      `<div class="message-line my-text">
        <div class="message-box my-text${!lightMode ? " dark" : ""}">
          <div class="me">${userMessage}</div>
        </div>
        <button id="${userRepeatButtonID}" class="btn volume repeat-button" onclick="userRepeatButtonIDToRecordingMap[this.id].play()"><i class="fa fa-volume-up"></i></button>
      </div>`
    );
  } else {
    $("#message-list").append(
      `<div class="message-line my-text">
        <div class="message-box my-text${!lightMode ? " dark" : ""}">
          <div class="me">${userMessage}</div>
        </div>
      </div>`
    );
  }

  scrollToBottom();
};

const populateBotResponse = async (userMessage) => {
  hideError();
  setLoadingState(true);
  setConnectionStatus("thinking");
  await showBotLoadingAnimation();

  try {
    const response = await processUserMessage(userMessage);
    responses.push(response);

    const repeatButtonID = getRandomID();
    botRepeatButtonIDToIndexMap[repeatButtonID] = responses.length - 1;
    hideBotLoadingAnimation();

    $("#message-list").append(
      `<div class="message-line">
        <div class="message-box${!lightMode ? " dark" : ""}">${response.openaiResponseText}</div>
        <button id="${repeatButtonID}" class="btn volume repeat-button" onclick='playResponseAudio("data:audio/wav;base64," + responses[botRepeatButtonIDToIndexMap[this.id]].openaiResponseSpeech)'><i class="fa fa-volume-up"></i></button>
      </div>`
    );

    playResponseAudio("data:audio/wav;base64," + response.openaiResponseSpeech);
    setConnectionStatus("ready");
  } catch (err) {
    hideBotLoadingAnimation();
    showError(err.message || "There was a problem processing your request.");
  } finally {
    setLoadingState(false);
    scrollToBottom();
  }
};

const loadModels = async () => {
  try {
    const response = await fetch(baseUrl + "/health");
    const data = await response.json();
    const supportedModels = data.supported_models || [];
    const modelSelect = $("#model-options");
    modelSelect.empty();

    if (!supportedModels.length) {
      throw new Error("No models are available yet.");
    }

    supportedModels.forEach((modelId) => {
      const option = `<option value="${modelId}">${modelId}</option>`;
      modelSelect.append(option);
    });

    selectedModel = supportedModels[0];
    modelSelect.val(selectedModel);
    $("#default-model-label").text(selectedModel);
    setConnectionStatus("ready");
  } catch (err) {
    showError(err.message || "Unable to load models.");
    setConnectionStatus("offline");
  }
};

$(document).ready(function () {
  loadModels();

  $("#message-input").keyup(function (event) {
    let inputVal = cleanTextInput($("#message-input").val());

    if (event.keyCode === 13 && inputVal !== "") {
      const message = inputVal;
      populateUserMessage(message, null);
      populateBotResponse(message);
    }

    inputVal = $("#message-input").val();

    if (inputVal === "" || inputVal == null) {
      $("#send-button").removeClass("send").addClass("microphone").html("<i class='fa fa-microphone'></i>");
    } else {
      $("#send-button").removeClass("microphone").addClass("send").html("<i class='fa fa-paper-plane'></i>");
    }
  });

  $("#send-button").click(async function () {
    hideError();

    if ($("#send-button").hasClass("microphone") && !recording) {
      await toggleRecording();
      $(".fa-microphone").css("color", "#f44336");
      return;
    }

    if (recording) {
      const userRecording = await toggleRecording();
      $(".fa-microphone").css("color", "#125ee5");
      if (!userRecording) {
        return;
      }
      await showUserLoadingAnimation();
      try {
        const userMessage = await getSpeechToText(userRecording);
        populateUserMessage(userMessage, userRecording);
        populateBotResponse(userMessage);
      } catch (err) {
        hideUserLoadingAnimation();
        showError(err.message || "Voice processing failed.");
        setConnectionStatus("ready");
      }
      return;
    }

    const message = cleanTextInput($("#message-input").val());
    if (!message) {
      showError("الرجاء كتابة رسالة أو الضغط على الميكروفون للتسجيل الصوتي.");
      return;
    }
    populateUserMessage(message, null);
    populateBotResponse(message);
    $("#send-button").removeClass("send").addClass("microphone").html("<i class='fa fa-microphone'></i>");
  });

  $("#light-dark-mode-switch").change(function () {
    $("body").toggleClass("dark-mode");
    $(".message-box").toggleClass("dark");
    $(".loading-dots").toggleClass("dark");
    $(".dot").toggleClass("dark-dot");
    lightMode = !lightMode;
  });

  $("#voice-options").change(function () {
    voiceOption = $(this).val();
  });

  $("#model-options").change(function () {
    selectedModel = $(this).val();
    $("#default-model-label").text(selectedModel);
  });

  setConnectionStatus("ready");
});
