let recorder = null;
let recording = false;
let voiceOption = "default";
let selectedModel = "";
let lightMode = true;

const responses = [];
const botRepeatButtonIDToIndexMap = {};
const userRepeatButtonIDToRecordingMap = {};
const baseUrl = window.location.origin;

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

const getSpeechToText = async (userRecording) => {
  let response = await fetch(baseUrl + "/speech-to-text", {
    method: "POST",
    body: userRecording.audioBlob,
  });
  response = await response.json();
  if (!response.text) {
    throw new Error(response.error || "Speech recognition failed");
  }
  return response.text;
};

const processUserMessage = async (userMessage) => {
  let response = await fetch(baseUrl + "/process-message", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      userMessage: userMessage,
      voice: voiceOption,
      modelName: selectedModel,
    }),
  });
  response = await response.json();
  if (response.error) {
    throw new Error(response.error);
  }
  return response;
};

const cleanTextInput = (value) => {
  return value
    .trim()
    .replace(/[\n\t]/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&;]/g, "");
};

const recordAudio = () => {
  return new Promise(async (resolve) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    recorder = await recordAudio();
    recording = true;
    recorder.start();
    setConnectionStatus("recording");
    return null;
  }

  const audio = await recorder.stop();
  recording = false;
  setConnectionStatus("processing");
  return audio;
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
  await showBotLoadingAnimation();
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
  scrollToBottom();
};

const loadModels = async () => {
  const response = await fetch(baseUrl + "/health");
  const data = await response.json();
  const supportedModels = data.supported_models || [];
  const modelSelect = $("#model-options");
  modelSelect.empty();

  supportedModels.forEach((modelId) => {
    const option = `<option value="${modelId}">${modelId}</option>`;
    modelSelect.append(option);
  });

  selectedModel = supportedModels[0] || "";
  modelSelect.val(selectedModel);
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
    if ($("#send-button").hasClass("microphone") && !recording) {
      await toggleRecording();
      $(".fa-microphone").css("color", "#f44336");
    } else if (recording) {
      const userRecording = await toggleRecording();
      $(".fa-microphone").css("color", "#125ee5");
      await showUserLoadingAnimation();
      const userMessage = await getSpeechToText(userRecording);
      populateUserMessage(userMessage, userRecording);
      populateBotResponse(userMessage);
    } else {
      const message = cleanTextInput($("#message-input").val());
      populateUserMessage(message, null);
      populateBotResponse(message);
      $("#send-button").removeClass("send").addClass("microphone").html("<i class='fa fa-microphone'></i>");
    }
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
