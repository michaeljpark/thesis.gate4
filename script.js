// --- State Management ---
const STATE = {
    IDLE: 'idle',
    RECORDING: 'recording',
    REVIEW_PAUSED: 'review_paused',
    REVIEW_PLAYING: 'review_playing'
};

let currentState = STATE.IDLE;
let audioContext = null;
let mediaStream = null;
let scriptProcessor = null; // Used for live data access
let audioBuffer = null; // Complete recording buffer
let sourceNode = null; // Playback source

// Data Storage
let recordedSamples = []; // Float32 samples from left channel (Mono)
let sampleRate = 44100;
let duration = 0;

// Speech Recognition State
let recognition = null;
let transcriptBlocks = []; // [{ startTime: 0, text: "..." }]
let activeTranscriptBlock = null;
let finalTranscriptPrefix = ""; // For continuous session if needed
let interimTranscript = "";

// Playback & Time
let currentTime = 0; // The central "playhead" time
let startTime = 0; // Timestamp when playback/record started

// Visualization Config
const PX_PER_SECOND = 100; // Zoom level: 100px = 1 second
const BAR_WIDTH = 4; // Increased width for "bigger shapes"
const BAR_GAP = 2; // Increased gap slightly
const BAR_STRIDE = BAR_WIDTH + BAR_GAP; 
// Thus: Samples per bar = SampleRate / (PX_PER_SECOND / BAR_STRIDE)
// e.g., 44100 / (100 / 6) = 2646 samples per bar

// UI References
const timeDisplay = document.getElementById('time-display');
const canvas = document.getElementById('waveform-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('visualizer-container');
const btnRecord = document.getElementById('btn-record');
const playbackWrapper = document.getElementById('playback-wrapper'); // Wrapper
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnDone = document.getElementById('btn-done'); 
const btnDelete = document.getElementById('btn-delete');

// Speech UI
const finalTextElem = document.getElementById('final-text');
const interimTextElem = document.getElementById('interim-text');
const keywordsContainer = document.getElementById('keywords-container');

// --- Prompts Logic ---
const PROMPT_DATA = [
    {
        text: "Let’s talk about\ntomorrow’s schedule",
        icon: `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M45.8327 29.1667V25C45.8327 17.1433 45.8327 13.2149 43.3918 10.7741C40.9512 8.33334 37.0227 8.33334 29.166 8.33334H20.8327C12.9759 8.33334 9.04758 8.33334 6.60679 10.7741C4.16602 13.2149 4.16602 17.1433 4.16602 25V29.1667C4.16602 37.0233 4.16602 40.9519 6.60679 43.3925C9.04758 45.8333 12.9759 45.8333 20.8327 45.8333H29.166" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M14.584 8.33334V5.20834" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M35.416 8.33334V5.20834" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M37.5 43.75C40.9518 43.75 43.75 40.9518 43.75 37.5C43.75 34.0482 40.9518 31.25 37.5 31.25C34.0482 31.25 31.25 34.0482 31.25 37.5C31.25 40.9518 34.0482 43.75 37.5 43.75Z" stroke="white" stroke-width="2"/><path d="M42.709 42.7083L45.834 45.8333" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M5.20898 18.75H44.7923" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`
    },
    {
        text: "Let’s talk about\nwhat’s on your mind",
        icon: `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M47.6562 25.7813C47.6541 23.7763 47.0598 21.8166 45.9479 20.1483C44.836 18.4799 43.256 17.1771 41.4063 16.4035L41.4062 14.0625C41.4067 12.1011 40.736 10.1986 39.5057 8.6711C38.2753 7.14358 36.5593 6.08301 34.6429 5.66559C32.7264 5.24816 30.7248 5.49902 28.9707 6.37649C27.2165 7.25395 25.8153 8.70519 25 10.4891C24.1847 8.70519 22.7835 7.25395 21.0293 6.37649C19.2752 5.49902 17.2736 5.24816 15.3571 5.66559C13.4406 6.08301 11.7247 7.14358 10.4943 8.6711C9.264 10.1986 8.59332 12.1011 8.59375 14.0625L8.59365 16.4035C6.74278 17.1749 5.16162 18.4769 4.04942 20.1454C2.93722 21.8138 2.34374 23.7742 2.34375 25.7794C2.34376 27.7846 2.93726 29.7449 4.04948 31.4134C5.1617 33.0819 6.74286 34.3838 8.59375 35.1552V35.9375C8.59332 37.8989 9.264 39.8014 10.4943 41.3289C11.7247 42.8564 13.4406 43.917 15.3571 44.3344C17.2736 44.7519 19.2752 44.501 21.0293 43.6235C22.7835 42.7461 24.1847 41.2948 25 39.5109C25.8153 41.2948 27.2165 42.7461 28.9707 43.6235C30.7248 44.501 32.7264 44.7519 34.6429 44.3344C36.5593 43.917 38.2753 42.8564 39.5057 41.3289C40.736 39.8014 41.4067 37.8989 41.4062 35.9375V35.1552C43.2558 34.3824 44.8357 33.0804 45.9477 31.4126C47.0597 29.7449 47.6541 27.7857 47.6562 25.7813ZM17.1875 42.9688C15.3233 42.9667 13.5361 42.2252 12.218 40.907C10.8998 39.5889 10.1583 37.8017 10.1562 35.9375V35.6615C10.9241 35.8444 11.7107 35.937 12.5 35.9375H14.0625C14.2697 35.9375 14.4684 35.8552 14.6149 35.7087C14.7614 35.5622 14.8437 35.3635 14.8437 35.1563C14.8437 34.9491 14.7614 34.7503 14.6149 34.6038C14.4684 34.4573 14.2697 34.375 14.0625 34.375H12.5C10.4726 34.3746 8.51067 33.6577 6.96077 32.3508C5.41087 31.0439 4.3728 29.2312 4.03001 27.233C3.68721 25.2349 4.06175 23.1798 5.08744 21.4311C6.11313 19.6823 7.72395 18.3524 9.63526 17.6764C9.78758 17.6225 9.91945 17.5227 10.0127 17.3908C10.106 17.2589 10.1561 17.1013 10.1561 16.9397L10.1562 14.0625C10.1562 12.1977 10.897 10.4093 12.2157 9.09067C13.5343 7.77205 15.3227 7.03126 17.1875 7.03126C19.0523 7.03126 20.8407 7.77205 22.1593 9.09067C23.478 10.4093 24.2187 12.1977 24.2187 14.0625V31.0056C23.4272 29.8752 22.3749 28.9522 21.1509 28.3148C19.927 27.6774 18.5675 27.3443 17.1875 27.3438C16.9803 27.3438 16.7816 27.4261 16.6351 27.5726C16.4886 27.7191 16.4062 27.9178 16.4062 28.125C16.4062 28.3322 16.4886 28.5309 16.6351 28.6774C16.7816 28.824 16.9803 28.9063 17.1875 28.9063C19.0523 28.9063 20.8407 29.6471 22.1593 30.9657C23.478 32.2843 24.2187 34.0727 24.2187 35.9375C24.2187 37.8023 23.478 39.5907 22.1593 40.9094C20.8407 42.228 19.0523 42.9688 17.1875 42.9688ZM37.5 34.375H35.9375C35.7303 34.375 35.5316 34.4573 35.3851 34.6038C35.2386 34.7503 35.1562 34.9491 35.1562 35.1563C35.1562 35.3635 35.2386 35.5622 35.3851 35.7087C35.5316 35.8552 35.7303 35.9375 35.9375 35.9375H37.5C38.2893 35.937 39.0759 35.8444 39.8438 35.6615V35.9375C39.8438 37.3282 39.4314 38.6876 38.6588 39.8439C37.8862 41.0001 36.788 41.9014 35.5032 42.4335C34.2184 42.9657 32.8047 43.105 31.4408 42.8337C30.0768 42.5624 28.824 41.8927 27.8407 40.9094C26.8573 39.926 26.1877 38.6732 25.9164 37.3092C25.645 35.9453 25.7843 34.5316 26.3165 33.2468C26.8486 31.962 27.7499 30.8638 28.9061 30.0912C30.0624 29.3186 31.4219 28.9063 32.8125 28.9063C33.0197 28.9063 33.2184 28.824 33.3649 28.6774C33.5114 28.5309 33.5938 28.3322 33.5938 28.125C33.5938 27.9178 33.5114 27.7191 33.3649 27.5726C33.2184 27.4261 33.0197 27.3438 32.8125 27.3438C31.4325 27.3443 30.073 27.6774 28.8491 28.3148C27.6251 28.9522 26.5728 29.8752 25.7812 31.0056V14.0625C25.7812 12.1977 26.522 10.4093 27.8407 9.09067C29.1593 7.77205 30.9477 7.03126 32.8125 7.03126C34.6773 7.03126 36.4657 7.77205 37.7843 9.09067C39.103 10.4093 39.8438 12.1977 39.8438 14.0625L39.8439 16.9397C39.8439 17.1013 39.894 17.2589 39.9873 17.3908C40.0806 17.5227 40.2124 17.6225 40.3647 17.6764C42.2761 18.3524 43.8869 19.6823 44.9126 21.4311C45.9383 23.1798 46.3128 25.2349 45.97 27.233C45.6272 29.2312 44.5891 31.0439 43.0392 32.3508C41.4893 33.6577 39.5274 34.3746 37.5 34.375ZM17.9687 17.9688C17.9669 19.6258 17.3078 21.2144 16.1361 22.3861C14.9644 23.5578 13.3758 24.2169 11.7187 24.2188C11.5115 24.2188 11.3128 24.1365 11.1663 23.9899C11.0198 23.8434 10.9375 23.6447 10.9375 23.4375C10.9375 23.2303 11.0198 23.0316 11.1663 22.8851C11.3128 22.7386 11.5115 22.6563 11.7187 22.6563C12.9615 22.6549 14.153 22.1605 15.0318 21.2818C15.9105 20.403 16.4048 19.2115 16.4062 17.9688V16.4063C16.4062 16.1991 16.4886 16.0003 16.6351 15.8538C16.7816 15.7073 16.9803 15.625 17.1875 15.625C17.3947 15.625 17.5934 15.7073 17.7399 15.8538C17.8864 16.0003 17.9687 16.1991 17.9687 16.4063V17.9688ZM39.0625 23.4375C39.0625 23.6447 38.9802 23.8434 38.8337 23.9899C38.6872 24.1364 38.4884 24.2188 38.2812 24.2188C36.6242 24.2169 35.0356 23.5578 33.8639 22.3861C32.6922 21.2144 32.0331 19.6258 32.0312 17.9688V16.4063C32.0312 16.1991 32.1136 16.0003 32.2601 15.8538C32.4066 15.7073 32.6053 15.625 32.8125 15.625C33.0197 15.625 33.2184 15.7073 33.3649 15.8538C33.5114 16.0003 33.5938 16.1991 33.5938 16.4063V17.9688C33.5952 19.2115 34.0895 20.403 34.9682 21.2818C35.847 22.1605 37.0385 22.6549 38.2812 22.6563C38.4884 22.6563 38.6872 22.7386 38.8337 22.8851C38.9802 23.0316 39.0625 23.2303 39.0625 23.4375Z" fill="white"/></svg>`
    },
    {
        text: "Let’s talk about\nwhat you learned today",
        icon: `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M41.4544 33.3333H16.4544C14.5169 33.3333 13.5482 33.3333 12.7534 33.5462C10.5966 34.1241 8.9119 35.8089 8.33398 37.9656" stroke="white" stroke-width="2"/><path d="M16.666 14.5833H33.3327" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M16.666 21.875H27.0827" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M40.6243 39.5833H16.666" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20.834 45.8334C14.9414 45.8334 11.9952 45.8334 10.1646 44.0027C8.33398 42.1721 8.33398 39.2259 8.33398 33.3334V16.6667C8.33398 10.7741 8.33398 7.82785 10.1646 5.99727C11.9952 4.16669 14.9414 4.16669 20.834 4.16669H29.1673C35.0598 4.16669 38.0061 4.16669 39.8367 5.99727C41.6673 7.82785 41.6673 10.7741 41.6673 16.6667M29.1673 45.8334C35.0598 45.8334 38.0061 45.8334 39.8367 44.0027C41.6673 42.1721 41.6673 39.2259 41.6673 33.3334V25" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`
    },
    {
        text: "Let’s talk about\nyour concerns",
        icon: `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.6966 1.00242C29.8451 0.885236 36.4271 5.02586 39.3763 11.5493C40.431 13.893 40.9779 16.393 40.9779 18.9712C40.9779 19.0688 40.9779 19.6157 40.9779 20.4555C41.1146 21.061 41.6419 21.6665 42.1888 22.2134L42.8529 22.8384C44.0638 23.9907 44.6302 24.5571 44.806 24.772C45.1576 25.1821 45.3724 25.5923 45.5091 26.0024C45.9583 27.3696 44.8841 28.0337 44.5326 28.268C44.2005 28.4634 43.8294 28.6587 43.3997 28.854C43.0677 29.0102 42.6966 29.1665 42.3646 29.3227C42.3255 29.3423 42.2669 29.3618 42.2279 29.3813C41.9544 31.1977 40.9193 38.0727 40.8997 38.1313C40.763 39.2837 40.3724 40.1626 39.7279 40.7485C38.5951 41.7837 37.0716 41.7446 35.8412 41.7056C34.9232 41.686 34.1419 41.686 33.3021 41.686C33.2435 42.4087 33.1849 43.4829 33.1263 44.4204C33.0482 45.4555 32.9896 46.5298 32.931 47.3501C32.9115 47.7993 32.6771 48.2095 32.3255 48.5024C32.0521 48.7173 31.7005 48.8345 31.3685 48.8345C31.2708 48.8345 31.1537 48.8149 31.056 48.7954L11.0755 44.8306C10.0013 44.6157 9.22006 43.6587 9.22006 42.5649V38.9321C9.22006 34.6548 8.30209 30.3384 6.46616 26.1196C5.45053 23.7759 4.96225 21.2563 5.00131 18.6587C5.17709 8.89305 12.9701 1.15867 22.6966 1.00242ZM8.18491 25.3579C10.1185 29.811 11.0951 34.3813 11.0951 38.9321V42.5649C11.0951 42.7602 11.2318 42.936 11.4271 42.9751L31.0365 46.8813C31.0951 46.1196 31.1537 45.2016 31.2122 44.3032C31.4466 40.6899 31.4662 40.6509 31.5052 40.4946L31.7005 39.811H32.4232H32.599C33.6927 39.811 34.7083 39.7915 35.8802 39.8305C36.8568 39.8501 37.8724 39.8891 38.4388 39.3813C38.7318 39.1079 38.9271 38.6196 39.0052 37.9165C39.0247 37.7993 40.3919 28.7173 40.3919 28.7173L40.431 28.4438L40.6068 28.229L40.8216 27.9946C41.0365 27.8188 41.2708 27.7407 41.4466 27.6626L41.5638 27.6235C41.8958 27.4868 42.2279 27.3306 42.5794 27.1743C42.9505 26.9985 43.263 26.8423 43.5169 26.686C43.5951 26.647 43.6341 26.6079 43.6732 26.5688C43.6146 26.393 43.4974 26.2173 43.3216 25.9829C43.1654 25.7876 42.1107 24.772 41.5247 24.2251C41.2513 23.9712 41.0169 23.7368 40.8607 23.5805C40.0599 22.7798 39.2787 21.8813 39.1029 20.7095L39.0833 20.6313V20.5532C39.0833 19.6548 39.0833 19.0884 39.0833 18.9907C39.0833 16.6665 38.5951 14.4399 37.6576 12.3501C35.0013 6.51024 29.1029 2.7993 22.7162 2.89696C14.0052 3.03367 7.03256 9.96727 6.87631 18.6782C6.83725 21.0024 7.28647 23.268 8.18491 25.3579Z" fill="white"/><path d="M25.8242 8.61963H21C18.5977 8.61963 16.3516 9.55713 14.6328 11.2563C14.2227 11.686 13.8711 12.0962 13.5781 12.5063C12.543 14.0103 11.9961 15.7681 11.9961 17.604C11.9961 20.2798 13.1875 22.7993 15.2188 24.4985C14.8281 25.2798 14.3398 26.022 13.7539 26.686C13.4023 27.0767 13.3242 27.6431 13.5391 28.1118C13.7539 28.5806 14.2227 28.8931 14.75 28.8931C17.2891 28.8931 19.6719 28.0923 21.7031 26.5884H25.8242C28.2266 26.5884 30.4922 25.6509 32.1914 23.9517C33.8906 22.2524 34.8281 19.9868 34.8281 17.5845C34.8281 12.6626 30.7852 8.61963 25.8242 8.61963ZM30.8437 22.6431C29.4961 23.9907 27.7188 24.7329 25.8047 24.7329H21.0195L20.7656 24.9282C19.3398 26.0415 17.6992 26.7446 15.9414 26.9595C16.4687 26.2173 16.8984 25.4165 17.25 24.5767L17.5234 23.8735L16.918 23.4438C15.0234 22.1157 13.8906 19.9282 13.8906 17.6235C13.8906 16.1782 14.3203 14.772 15.1406 13.5806C15.375 13.2485 15.6484 12.9165 15.9609 12.5845C17.3086 11.2368 19.1055 10.4946 21 10.4946H25.8242C29.75 10.4946 32.9336 13.6782 32.9336 17.604C32.9336 19.5376 32.1914 21.3149 30.8437 22.6431Z" fill="white"/></svg>`
    },
];

let currentPromptIndex = 0;
const promptBox = document.getElementById('prompt-box');

function initPrompts() {
    renderPrompt(currentPromptIndex); // Show first
    promptBox.addEventListener('click', onPromptClick);
}

function onPromptClick(e) {
    // If flipped (showing back), do not cycle prompts unless desired.
    // Assuming back face interaction is separate.
    if (promptBox.classList.contains('flipped-state')) return;

    // Add animation out
    const content = promptBox.querySelector('.prompt-content');
    if (content) {
        content.classList.remove('flip-in');
        content.classList.add('flip-out');
    }
    
    // Wait for animation
    setTimeout(() => {
        currentPromptIndex = (currentPromptIndex + 1) % PROMPT_DATA.length;
        renderPrompt(currentPromptIndex, true); 
    }, 250); // Slightly less than CSS time for snappiness
}

function renderPrompt(index, animateIn = false) {
    const data = PROMPT_DATA[index];
    const html = `
        <div class="prompt-content ${animateIn ? 'flip-in' : ''}">
            <div class="prompt-text">${data.text}</div>
            <div class="prompt-icon">${data.icon}</div>
        </div>
    `;
    const faceFront = document.getElementById('prompt-face-front');
    if (faceFront) {
        faceFront.innerHTML = html;
    } else {
        // Fallback for safety or init timing
        console.warn("Prompt Face Front not found");
        promptBox.innerHTML = `<div class="card-face face-front" id="prompt-face-front">${html}</div><div class="card-face face-back" id="prompt-face-back"></div>`;
    }
}

// --- Initialization ---

(function init() {
    initSpeechRecognition();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Request Mic immediately
    requestMicrophoneAccess();
    
    initPrompts(); // Initialize prompts

    // Buttons
    btnRecord.addEventListener('click', onRecordClick);
    btnPlay.addEventListener('click', onPlayClick);
    btnPause.addEventListener('click', onPauseClick);
    btnDone.addEventListener('click', onDoneClick);
    btnDelete.addEventListener('click', onDeleteClick);

    // Canvas Interaction (Drag/Scrub)
    container.addEventListener('pointerdown', onPointerDown);
    
    // Initial Render
    draw();
})();

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    draw();
}

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sampleRate = audioContext.sampleRate;
    }
}

async function requestMicrophoneAccess() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false
            } 
        });
        console.log("Microphone access granted.");
    } catch (err) {
        console.error("Mic Error on Init:", err);
        // We can retry on button click if this fails
    }
}

function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; // Default to English

        recognition.onstart = function() {
            console.log("Speech Recognition Started");
        };

        recognition.onend = function() {
            console.log("Speech Recognition Ended. Restarting...");
            // Auto-restart to keep permission "hot"
            try {
                recognition.start();
            } catch(e) {
                console.log("Restart ignore", e);
            }
        };

        recognition.onresult = (event) => {
            // Only process if we are actually "Recording" in our app state
            if (currentState !== STATE.RECORDING) return;

            let sessionFinal = '';
            let sessionInterim = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    sessionFinal += event.results[i][0].transcript;
                } else {
                    sessionInterim += event.results[i][0].transcript;
                }
            }

            // Update active block
            if (activeTranscriptBlock) {
                // Better approach for continuous:
                // Construct the WHOLE text of the current session from event.results
                // Note: resetting text based on full session might duplicate if we had history?
                // Actually with continuous=true, resultIndex increments? 
                // Let's stick to appending new final + interim for this logic
                
                // Correction: When continuous=true, event.results accumulates. 
                // We should just grab what's new or rely on the logic we had.
                
                activeTranscriptBlock.text = activeTranscriptBlock.text || "";
                
                // Start fresh for this result event? 
                // Actually, simply:
                // If it's a new segment, append. 
                // But simplifying:
                activeTranscriptBlock.text += sessionFinal;
                
                // Track Speech Time for better sync
                if (sessionFinal.length > 0 || sessionInterim.length > 0) {
                     activeTranscriptBlock.speechEndTime = currentTime;
                }
            }
            
            interimTranscript = sessionInterim;
            updateTranscriptUI();
            updateInfoCardLocal();
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech') return; // Ignore no-speech errors
            console.error('Speech recognition error', event.error);
        };
        
        // Start immediately on Init
        try {
            recognition.start();
        } catch(e) {
            console.log("Auto-start recognition failed (will retry on click):", e);
        }
    }
}

function updateTranscriptUI() {
    // Combine all previous blocks + active block
    let contextHTML = '';
    
    transcriptBlocks.forEach(block => {
        contextHTML += block.text; 
    });

    finalTextElem.innerText = contextHTML;
    interimTextElem.innerText = interimTranscript;
    
    // Update Word Count
    const fullTextForCount = (contextHTML + " " + interimTranscript).trim();
    const wordCount = fullTextForCount.length > 0 ? fullTextForCount.split(/\s+/).length : 0;
    const wordCountElem = document.getElementById('word-count');
    if(wordCountElem) {
        wordCountElem.textContent = `${wordCount}/3000`; // Limit format per request
    }

    // Auto scroll to bottom
    const container = document.getElementById('transcript-container');
    container.scrollTop = container.scrollHeight;

    // Check for content to enable/disable "Done" button
    const btnDone = document.getElementById('btn-done');
    if (btnDone) {
        // Simple plain text check
        const hasContent = contextHTML.trim().length > 0 || interimTranscript.trim().length > 0;
        
        if (hasContent) {
            btnDone.style.visibility = 'visible';
            btnDone.style.opacity = '1';
            btnDone.disabled = false;
        } else {
            // Hide or disable. User asked to disable? 
            // "보내기 버튼 비활성화해" -> In UI usually grayed out.
            // But existing CSS has visibility: hidden for initial state.
            // Let's use opacity/pointer-events for a "disabled" look if we want it visible but inactive,
            // or just hide it if that's the established pattern.
            // Based on initial read: style="visibility: hidden;" was default.
            btnDone.style.visibility = 'hidden'; 
            btnDone.style.opacity = '0';
            btnDone.disabled = true;
        }
    }
}

// --- CONFIG ---
// Pollinations AI (Free, No Key Required)
// const GEMINI_API_KEY = "AIzaSyDVPXOsuM6aLEtsDlR8MYIBdiwxKIpoNDM"; 

async function updateInfoCardLocal() {
    // Build text from blocks to avoid UI artifacts like cursors
    let fullText = transcriptBlocks.map(b => b.text).join(' ');
    if (activeTranscriptBlock) {
        fullText += " " + activeTranscriptBlock.text;
    }
    // Also add interim if any (though usually merged by now if called after stop)
    if (interimTranscript) {
        fullText += " " + interimTranscript;
    }

    if (!fullText.trim() || fullText.trim().length < 5) return; // Skip if too short

    // UI Elements
    const sTitle = document.getElementById('schedule-title');
    const sDate = document.getElementById('schedule-date');
    const sTag = document.getElementById('schedule-tag');
    const sTime = document.getElementById('schedule-time');
    const container = document.getElementById('keywords-container');

    // --- LOCAL KEYWORD EXTRACTION LOGIC ---
    const lowerText = fullText.toLowerCase();

    const categories = {
        date: ['today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekend'],
        event: ['meeting', 'call', 'seminar', 'workshop', 'conference', 'interview', 'sync', 'standup', 'brainstorm'],
        work: ['project', 'deadline', 'client', 'budget', 'report', 'presentation', 'proposal', 'contract', 'thesis', 'design', 'code', 'bug', 'feature']
    };

    const findMatches = (list) => {
        return list.filter(word => lowerText.includes(word));
    };

    const dateMatches = findMatches(categories.date);
    const eventMatches = findMatches(categories.event);
    const workMatches = findMatches(categories.work);

    // Combine and Deduplicate
    let allMatches = [...eventMatches, ...workMatches, ...dateMatches];
    let uniqueKeywords = [...new Set(allMatches)];

    // Helper for Title Case
    const toTitleCase = (str) => {
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    };

    // Generate Title
    let title = "Daily Insight"; // Changed from "Voice Memo"
    if (eventMatches.length > 0) {
        const mainEvent = toTitleCase(eventMatches[0]);
        if (workMatches.length > 0) {
             title = `${toTitleCase(workMatches[0])} ${mainEvent}`;
        } else {
             title = `${mainEvent} Focus`; // Changed "Note" to "Focus"
        }
    } else if (workMatches.length > 0) {
        title = `${toTitleCase(workMatches[0])} Update`;
    } else if (dateMatches.length > 0) {
        title = `${toTitleCase(dateMatches[0])}'s Journal`; // Changed "Note" to "Journal"
    }

    // Generate Keywords (Max 3)
    let finalKeywords = uniqueKeywords.slice(0, 3).map(k => toTitleCase(k));
    if (finalKeywords.length === 0) {
        finalKeywords = ["General", "Memo"];
    }

    // --- UPDATE UI ---
    
    // 1. Title
    if (sTitle) sTitle.textContent = title;

    // 2. Date
    const now = new Date();
    const day = now.getDate();
    const suffix = (day % 10 == 1 && day != 11) ? 'st' : (day % 10 == 2 && day != 12) ? 'nd' : (day % 10 == 3 && day != 13) ? 'rd' : 'th';
    const formattedDate = `${now.toLocaleString('default', { month: 'long' })} ${day}${suffix}, ${now.getFullYear()}`;
    if (sDate) sDate.textContent = formattedDate;

    // 3. Time
    if (sTime) {
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        sTime.textContent = `${hours}:${minutes}`;
    }

    // 4. Tag (First Keyword)
    if (sTag && finalKeywords.length > 0) {
        sTag.textContent = '#' + finalKeywords[0];
    }

    // 5. Keywords Container (Chips)
    if (container) {
        container.innerHTML = ''; 
        finalKeywords.forEach(k => {
            const chip = document.createElement('div');
            chip.className = 'keyword-chip';
            chip.textContent = '#' + k;
            container.appendChild(chip);
        });
    }
}

function updateKeywords() {
    // Legacy generic regex logic removed/disabled in favor of AI calls on Stop.
    // We leave this empty or minimal for real-time updates if needed, 
    // but the user requested AI backend logic "when recording finishes".
}

// --- Logic: Recording ---

async function onRecordClick() {
    initAudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();

    if (currentState === STATE.RECORDING) {
        stopAction();
    } else {
        // Start Recording
        startRecording();
    }
}

async function startRecording() {
    // 1. Playback Interrupt
    if (currentState === STATE.REVIEW_PLAYING || sourceNode) {
        try { sourceNode.stop(); } catch(e) {}
        sourceNode = null;
    }

    initAudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();

    // Singleton MediaStream: Reuse if available and active to prevent permission spam
    let isStreamActive = false;
    // Check if mediaStream exists and has active tracks
    if (mediaStream) {
         const tracks = mediaStream.getAudioTracks();
         if (tracks.length > 0 && tracks[0].readyState === 'live') {
             isStreamActive = true;
         }
    }

    if (!isStreamActive) {
        try {
            // Constraints to prevent browser from auto-lowering volume (AGC)
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                } 
            });
        } catch (err) {
            console.error("Mic Error:", err);
            // alert("Microphone access is required."); // Remove alert to reduce annoyance
            return;
        }
    }

    // Explicitly ensure tracks are enabled (in case they were muted/disabled elsewhere, though we don't do that)
    if (mediaStream) {
        mediaStream.getAudioTracks().forEach(track => track.enabled = true);
    }

    // Determine insert point
    // If we are at the end (or near end), we append.
    // If we are in the middle, we OVERWRITE from currentTime.
    
    // Prune data after currentTime if overwriting
    const cutSampleIndex = Math.floor(currentTime * sampleRate);
    if (cutSampleIndex < recordedSamples.length) {
        // We are overwriting!
        recordedSamples = recordedSamples.slice(0, cutSampleIndex);
        
        // --- STT Logic: Prune Blocks ---
        // 1. Remove blocks that start strictly AFTER the cut point
        transcriptBlocks = transcriptBlocks.filter(b => b.startTime < currentTime);
        
        // 2. Truncate the overlapping/last block if it crosses the line
        if (transcriptBlocks.length > 0) {
            const lastBlock = transcriptBlocks[transcriptBlocks.length - 1];
            // If this block ended AFTER currentTime (or hasn't ended), potential overlap
            const blockEnd = lastBlock.endTime || duration; 
            
            if (blockEnd > currentTime) {
                // Determine ratio of time to keep
                const blockDur = blockEnd - lastBlock.startTime;
                if (blockDur > 0) {
                    const keepDur = currentTime - lastBlock.startTime;
                    // Ratio of text roughly matching time
                    const ratio = Math.max(0, Math.min(1, keepDur / blockDur));
                    if (ratio < 1 && lastBlock.text) {
                         const cutLen = Math.floor(lastBlock.text.length * ratio);
                         lastBlock.text = lastBlock.text.substring(0, cutLen);
                    }
                }
                // Cap the endTime
                lastBlock.endTime = currentTime;
            }
        }
        
        // Reset UI
        updateTranscriptUI();
    }

    activeTranscriptBlock = { startTime: currentTime, text: "" };
    transcriptBlocks.push(activeTranscriptBlock);
    
    if (recognition) {
        try {
            // Check if already started
            // recognition.start(); // It is already running
        } catch (e) {
            // Ignore if already started
        }
    }

    updateState(STATE.RECORDING);

    const source = audioContext.createMediaStreamSource(mediaStream);
    // Use ScriptProcessor for raw data access (simpler for array accumulation than MediaRecorder for this specific waveform logic)
    // Note: AudioWorklet is better practice but ScriptProcessor is easier for single-file demo.
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    scriptProcessor.onaudioprocess = (e) => {
        if (currentState !== STATE.RECORDING) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Copy to our master array
        // Ideally chunk management or TypedArrays should be used for performance, 
        // but simple array push spread is risky for huge files. 
        // Let's punch it into a Float32Array on demand or use chunks.
        // For this demo: pushing to a standard array of chunks is safer, then flatten later.
        
        // Let's just push values. Modern JS engines handle large arrays okay-ish, 
        // but let's be safer:
        for (let i = 0; i < inputData.length; i++) {
            recordedSamples.push(inputData[i]);
        }
        
        // Update Time
        currentTime += inputData.length / sampleRate;
        duration = Math.max(duration, currentTime);
        
        // Auto Scroll
        draw();
        updateTimeDisplay();
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination); // Start flow
    
    // Keep track so we can disconnect
    scriptProcessor.sourceRef = source; 
}

function stopAction() {
    if (currentState === STATE.RECORDING) {
        // Stop processing node but KEEP mediaStream open for quick reuse
        if (scriptProcessor) {
            scriptProcessor.disconnect();
            if (scriptProcessor.sourceRef) scriptProcessor.sourceRef.disconnect();
            scriptProcessor = null;
        }

        // Stop Recognition
        // if (recognition) {
        //    recognition.stop();
        // }
        // We do NOT stop recognition to avoid permission prompts logic. 
        // It runs in background but we ignore results.
        
        // Finalize block
        if (activeTranscriptBlock) {
            // If we have pending interim text, append it now because stop() might flush pending results
            // but strict 'isFinal' might check later.
            // A common strategy: assume last interim is valid content if stop() was called.
            if (interimTranscript) {
                activeTranscriptBlock.text += " " + interimTranscript;
            }
            activeTranscriptBlock.endTime = currentTime;
            // Also clamp speechEndTime to currentTime if meaningful
            if (!activeTranscriptBlock.speechEndTime) {
                activeTranscriptBlock.speechEndTime = currentTime;
            }
        }
        
        // Do NOT set activeTranscriptBlock = null here yet?
        // Actually we must, to prevent 'onresult' from appending later if we start new logic?
        // But recognition is async.
        // Let's just seal it.
        activeTranscriptBlock = null; 
        interimTranscript = "";
        updateTranscriptUI();
        
        // Note: We do NOT stop mediaStream tracks here anymore to avoid re-asking permission.
        // We will cleanup mediaStream only on a "Full Reset" or page unload if needed.
        
        // Normalize buffer for playback
        createAudioBufferFromSamples();
        updateState(STATE.REVIEW_PAUSED);
        
        // Monitor local info update
        updateInfoCardLocal();
    } else if (currentState === STATE.REVIEW_PLAYING) {
        if (sourceNode) {
            try { sourceNode.stop(); } catch(e){}
        }
        updateState(STATE.REVIEW_PAUSED);
    }
}

function createAudioBufferFromSamples() {
    if (recordedSamples.length === 0) return;
    
    const buffer = audioContext.createBuffer(1, recordedSamples.length, sampleRate);
    
    // Convert to Float32Array
    const rawData = new Float32Array(recordedSamples);
    
    // Normalize Volume (Make it louder)
    // 1. Find the peak amplitude
    let maxAmp = 0;
    for (let i = 0; i < rawData.length; i++) {
        const abs = Math.abs(rawData[i]);
        if (abs > maxAmp) maxAmp = abs;
    }
    
    // 2. Calculate gain to boost peak to 0.95 (approx max volume)
    // Avoid dividing by zero or boosting noise too much if silent
    if (maxAmp > 0.0001) {
        // Cap the gain simply - if it's super quiet, don't blast noise.
        // But usually normalization is fine.
        const gain = 0.95 / maxAmp;
        
        // Apply gain
        for (let i = 0; i < rawData.length; i++) {
            rawData[i] *= gain;
        }
    }

    buffer.copyToChannel(rawData, 0);
    audioBuffer = buffer;
    duration = audioBuffer.duration;
}

// --- Logic: Playback ---

// Helper: Text Cursor Sync
function updateTextCursor(time) {
    if (currentState === STATE.RECORDING) {
        return;
    }
    
    // Find active block
    let renderedHTML = '';
    
    let cursorInserted = false;

    for (let i = 0; i < transcriptBlocks.length; i++) {
        const block = transcriptBlocks[i];
        const blockEnd = block.endTime || (transcriptBlocks[i+1] ? transcriptBlocks[i+1].startTime : duration);
        let blockText = block.text || "";
        
        // Check if cursor belongs in this block 
        if (!cursorInserted) {
            // Gap before block logic
            if (time < block.startTime) {
                 blockText = `<span class="text-cursor">|</span>` + blockText;
                 cursorInserted = true;
            } 
            // Inside block logic
            else if (time >= block.startTime && time <= blockEnd) {
                 const effectiveEnd = block.speechEndTime || blockEnd;
                 const blockDuration = effectiveEnd - block.startTime;
                 let progress = 1;
                 if (time < effectiveEnd) {
                    progress = (blockDuration > 0.01) ? (time - block.startTime) / blockDuration : 0;
                 }
                 
                 // Word Snapping Logic:
                 // 1. Tokenize (words + separators)
                 const tokens = blockText.split(/(\s+)/);
                 const totalLen = blockText.length;
                 let targetCharIdx = totalLen * progress;
                 
                 // User request: Move cursor forward by 3 chars
                 if (progress < 1) {
                     targetCharIdx += 3; 
                 }
                 
                 let closestDiff = Infinity;
                 let insertTokenIndex = 0; // Insert BEFORE this token index
                 
                 let runningLen = 0;
                 
                 // Check boundary 0 (Start of block)
                 if (Math.abs(targetCharIdx - 0) < closestDiff) {
                     closestDiff = Math.abs(targetCharIdx - 0);
                     insertTokenIndex = 0;
                 }
                 
                 // Check boundaries after each token
                 for (let t = 0; t < tokens.length; t++) {
                     runningLen += tokens[t].length;
                     let diff = Math.abs(targetCharIdx - runningLen);
                     if (diff < closestDiff) {
                         closestDiff = diff;
                         insertTokenIndex = t + 1;
                     }
                 }
                 
                 // Reconstruct text with cursor
                 blockText = "";
                 for (let t = 0; t <= tokens.length; t++) {
                     if (t === insertTokenIndex) {
                         blockText += `<span class="text-cursor">|</span>`;
                     }
                     if (t < tokens.length) {
                         blockText += tokens[t];
                     }
                 }
                 
                 cursorInserted = true;
            }
        }
        renderedHTML += blockText;
    }
    
    // If past last block
    if (!cursorInserted) {
        renderedHTML += `<span class="text-cursor">|</span>`;
    }
    
    finalTextElem.innerHTML = renderedHTML;
}

function onPlayClick() {
    if (!audioBuffer) return;
    // Always rebuild buffer just in case (e.g. after record)
    createAudioBufferFromSamples(); 
    
    // Auto-rewind if at the end (or very close to it)
    if (currentTime >= duration - 0.1) {
        currentTime = 0; 
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioContext.destination);
    
    sourceNode.start(0, currentTime);
    startTime = audioContext.currentTime - currentTime;
    
    updateState(STATE.REVIEW_PLAYING);
    requestAnimationFrame(playbackLoop);
    
    sourceNode.onended = () => {
        // Only if we naturally ended (not forced stop)
        if (currentTime >= duration - 0.1) {
             currentTime = duration; // Snap to end
             stopAction();
             draw();
        }
    };
}

function onPauseClick() {
    stopAction();
}

function playbackLoop() {
    if (currentState !== STATE.REVIEW_PLAYING) return;
    
    currentTime = audioContext.currentTime - startTime;
    updateTimeDisplay();
    draw();
    updateTextCursor(currentTime); // Sync Text Cursor
    
    if (currentTime < duration) {
        requestAnimationFrame(playbackLoop);
    }
}

// --- Radio Tuner Logic (Radiocomp Integration) ---
const radioChannels = [
    'Productivity',
    'Focus',
    'Daily Flow',
    'Discovery',
    'Entertainment'
];

let tunerItems = [];
const radioBoxWidth = 453; // Matches CSS
const radioItemWidth = radioBoxWidth / 2; // 226.5px
const radioSetRepeats = 5;
const radioCenterSetIndex = 2; // 0, 1, [2], 3, 4

function initTuner() {
    const track = document.getElementById('radio-track');
    if (!track) return; // Guard for safety

    // Prevent Double Init
    if (track.children.length > 0) return;

    let html = '';
    // Build the tick HTML structure precisely using tick-units
    let ticksHtml = '<div class="tick-mark-wrapper">';
    for (let i = 0; i < 21; i++) {
        if (i === 10) {
            ticksHtml += '<div class="tick-unit"><div class="major-tick"></div></div>';
        } else {
            ticksHtml += '<div class="tick-unit"><div class="minor-tick"></div></div>';
        }
    }
    ticksHtml += '</div>';

    for (let i = 0; i < radioSetRepeats; i++) {
        radioChannels.forEach((channel, index) => {
            html += `
                <div class="channel-item" data-index="${index}">
                    <div class="text-label">${channel}</div>
                    ${ticksHtml}
                </div>`;
        });
    }
    track.innerHTML = html;
    
    // Force widths
    tunerItems = Array.from(track.querySelectorAll('.channel-item'));
    tunerItems.forEach(item => {
        item.style.width = `${radioItemWidth}px`;
    });

    // Init Drag Logic
    const wrapper = document.querySelector('.radio-tuner-wrapper');
    if (wrapper) {
        wrapper.addEventListener('mousedown', startRadioDrag);
        wrapper.addEventListener('touchstart', startRadioDrag, { passive: false });
    }
    
    // Init Position
    const startItemIndex = radioCenterSetIndex * radioChannels.length;
    // Align center of item to center of box (which is at 50% left)
    // track left is 50%.
    // To center element i: translate = - (i * w + w/2)
    const startPos = -(startItemIndex * radioItemWidth + radioItemWidth / 2);
    updateRadioPosition(startPos);
    
    // Set initial theme without triggering fetch (it's done on Done Click)
    // Default is usually center of channel list.
    // radioChannels[2] in the list of 5 is 'Daily Flow' if set repeats is 5.
    // Actually our logic calculates active item based on position.
    // The "center set" is index 2. The startItemIndex points to start of set 2.
    // Wait, startItemIndex is `radioCenterSetIndex * radioChannels.length`. 
    // That's the FIRST item of the center set.
    // So the needle is at 'Productivity' (index 0).
    // Let's set that as default theme.
    currentRadioTheme = radioChannels[0]; // 'Productivity' by default logic above

    // Bind Controls
    const btnPlay = document.getElementById('radio-play-btn');
    if (btnPlay) {
        btnPlay.onclick = () => {
            // Prevent play if loading
            if (isRadioLoading) return;
            toggleTTS();
        };
    }
}

// Global state for Radio Drag
let radioCurrentX = 0;
let isRadioDragging = false;
let radioStartX = 0;
let radioVelocity = 0; 
let radioPreviousX = 0;
let radioTimestamp = 0;
let radioRafId = null;
let isRadioClickPossible = false; // To distinguish click from drag

function startRadioDrag(e) {
    if (radioRafId) cancelAnimationFrame(radioRafId); // user interrupted animation
    isRadioDragging = true;
    isRadioClickPossible = true; // Assume click initially
    radioStartX = getRadioPageX(e) - radioCurrentX;
    
    // For click detection
    radioDragStartPageX = getRadioPageX(e);

    radioPreviousX = getRadioPageX(e);
    radioTimestamp = Date.now();
    radioVelocity = 0;

    const wrapper = document.querySelector('.radio-tuner-wrapper');
    wrapper.style.cursor = 'grabbing';
    
    document.addEventListener('mousemove', onRadioDrag);
    document.addEventListener('touchmove', onRadioDrag, { passive: false });
    document.addEventListener('mouseup', stopRadioDrag);
    document.addEventListener('touchend', stopRadioDrag);
}
let radioDragStartPageX = 0; // Helper to measure drag distance

function getRadioPageX(e) {
    return e.touches ? e.touches[0].pageX : e.pageX;
}

function onRadioDrag(e) {
    if (!isRadioDragging) return;
    e.preventDefault();
    const x = getRadioPageX(e);
    
    // Check drag threshold for click
    if (Math.abs(x - radioDragStartPageX) > 5) {
        isRadioClickPossible = false;
    }

    const now = Date.now();
    const dt = now - radioTimestamp;
    
    // Calculate Velocity (px/ms)
    if (dt > 0) {
        radioVelocity = (x - radioPreviousX) / dt;
    }
    radioPreviousX = x;
    radioTimestamp = now;

    // Direct movement
    radioCurrentX = x - radioStartX;
    
    // Infinite Loop Logic (Teleport)
    const singleSetWidth = radioChannels.length * radioItemWidth;
    // We want to be in the "middle set" (Index 2 in 0-4 range).
    // Middle Set center is approx -singleSetWidth*2.5 ? No. 
    // StartItemIndex = 2 * L = 10. StartPos ~ -10*W.
    
    // Total Width of 5 sets = 5 * singleSetWidth.
    // Center Set Start = -singleSetWidth * 2. 
    // Center Set End = -singleSetWidth * 3.
    
    // If we drift too far Right (x > -singleSetWidth), we are in Set 0 or 1.
    // Teleport left by 1SetWidth * N? No, teleport to same relative position in Center Set.
    // Actually simple wrap:
    // If x > -singleSetWidth (Seeing Set 0) -> x -= singleSetWidth (Go to Set 1) ...
    // Let's keep it bounded between Set 1 and Set 3 (index 1 and 3). 
    // If we enter Set 0 region, jump to Set 3 region.
    // If we enter Set 4 region, jump to Set 1 region.
    
    const setWidth = singleSetWidth; 
    // Thresholds:
    // Set 0 region: x > -setWidth
    // Set 4 region: x < -setWidth * 4
    
    // To be safe, loop when we are 1 full set away from center.
    // Center Set (Index 2) is roughly [-2*W, -3*W].
    
    // Jump forward (Right to Left drag, going negative):
    // If we pass -3.5*W, jump back to -2.5*W?
    // Let's use simple modulo-like logic relative to Center Set Start (-2*W).
    
    // Actually, simple observation:
    // If currentX > -setWidth * 1 (Too far right, showing Set1 or Set0), subtract setWidth.
    // If currentX < -setWidth * 3 (Too far left, showing Set3 or Set4), add setWidth.
    
    if (radioCurrentX > -setWidth * 1.5) {
        radioCurrentX -= setWidth;
        radioStartX += setWidth; // Adjust startX so drag continues smoothly
    } else if (radioCurrentX < -setWidth * 3.5) {
        radioCurrentX += setWidth;
        radioStartX -= setWidth;
    }
    
    updateRadioPosition(radioCurrentX);
}

function stopRadioDrag(e) {
    isRadioDragging = false;
    const wrapper = document.querySelector('.radio-tuner-wrapper');
    if(wrapper) wrapper.style.cursor = 'grab';
    document.removeEventListener('mousemove', onRadioDrag);
    document.removeEventListener('touchmove', onRadioDrag);
    document.removeEventListener('mouseup', stopRadioDrag);
    document.removeEventListener('touchend', stopRadioDrag);
    
    // Handle Click (Navigation)
    if (isRadioClickPossible) {
        if (!e) return; // Should not happen on mouseup
        // Determine click position relative to center
        // Center of screen is winWidth / 2? No, box center.
        const rect = wrapper.getBoundingClientRect();
        const clickX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - rect.left;
        const centerX = rect.width / 2;
        
        // Threshold: center +/- 20%
        if (clickX < centerX - 50) {
            // Clicked Left -> Move Right (Prev Channel)
            shiftRadioChannel(-1);
            return;
        } else if (clickX > centerX + 50) {
            // Clicked Right -> Move Left (Next Channel)
            shiftRadioChannel(1);
            return;
        }
        // Center click -> maybe Play? (Already handled by btnPlay overlay)
    }

    // Start Momentum / Snap Animation
    requestAnimationFrame(animateRadioInertia);
}

function shiftRadioChannel(direction) {
    // animate snap to next index
    // direction: -1 (Prev), 1 (Next)
    // Target X should be current snapped index + direction * width
    // Current Index:
    let index = Math.round((-radioCurrentX - radioItemWidth/2) / radioItemWidth);
    let targetIndex = index + direction;
    
    // We update targetX
    const targetX = -(targetIndex * radioItemWidth + radioItemWidth/2);
    
    // Just use animation to go there
    // Cancel inertia
    radioVelocity = 0;
    animateSnap(targetX);
}

function animateRadioInertia() {
    if (isRadioDragging) return;

    // Decay velocity (Friction)
    radioVelocity *= 0.95;
    
    // Apply velocity
    radioCurrentX += radioVelocity * 16; // approx per frame
    
    // Infinite Loop Check during Inertia
    const setWidth = radioChannels.length * radioItemWidth;
    if (radioCurrentX > -setWidth * 1.5) {
        radioCurrentX -= setWidth;
    } else if (radioCurrentX < -setWidth * 3.5) {
        radioCurrentX += setWidth;
    }
    
    // If slow enough, SNAP
    if (Math.abs(radioVelocity) < 0.05) {
         snapRadioToNearestSmooth();
         return;
    }
    
    updateRadioPosition(radioCurrentX);
    radioRafId = requestAnimationFrame(animateRadioInertia);
}

function snapRadioToNearestSmooth() {
    // Find nearest neighbor
    // Center of item i is at -(i*W + W/2)
    // Current X -> Index?
    // -currentX = i*W + W/2
    // (-currentX - W/2) / W = i
    
    let index = Math.round((-radioCurrentX - radioItemWidth/2) / radioItemWidth);
    const targetX = -(index * radioItemWidth + radioItemWidth/2);
    
    // Determine the Channel Index (0-4)
    // index is the "physical" index. We need modulo length.
    // However, index can be large?
    // radioChannels.length = 5.
    // Physical index 12 -> 12 % 5 = 2.
    // But index can be negative? Our logic keeps it positive-ish (Set 1 to 3).
    // Let's safe modulo.
    const channelIdx = ((index % radioChannels.length) + radioChannels.length) % radioChannels.length;
    const channelName = radioChannels[channelIdx];

    // Trigger AI Loading if theme changed
    if (channelName !== currentRadioTheme) {
        handleRadioChannelChange(channelName);
    }

    // Animate to targetX using "Spring" or simple lerp
    // Let's use simple Lerp loop
    animateSnap(targetX);
}

// --- TTS Logic ---
let ttsQueue = [];
let ttsIndex = 0;
let isTTSPlaying = false;
let isTTSPaused = false;
let currentUtteranceObj = null;

function prepareTTS(sentences) {
    // Reset
    cancelTTS();
    ttsQueue = sentences; // Array of { text: string, elementId: string }
    ttsIndex = 0;
    isTTSPlaying = false;
    isTTSPaused = false;
}

function toggleTTS() {
    if (isTTSPlaying && !isTTSPaused) {
        pauseTTS();
    } else if (isTTSPaused) {
        resumeTTS();
    } else {
        playTTS();
    }
}

function playTTS() {
    if (ttsIndex >= ttsQueue.length) {
        ttsIndex = 0; // Restart if finished? Or Stop? Let's stop.
        // Actually typical media player behavior: Replay if at end, else play.
        // Let's restart.
    }

    isTTSPlaying = true;
    isTTSPaused = false;
    
    // Update Play Button UI (Pause Icon)
    updatePlayButtonUI(true);
    
    speakNextSentence();
}

function speakNextSentence() {
    if (ttsIndex >= ttsQueue.length) {
        // Finished
        isTTSPlaying = false;
        isTTSPaused = false;
        updatePlayButtonUI(false);
        return;
    }

    const item = ttsQueue[ttsIndex];
    
    // Highlight UI
    highlightSentence(item.elementId);

    // Create Utterance
    const u = new SpeechSynthesisUtterance(item.text);
    u.rate = 1.0; 
    u.lang = 'en-US'; 
    currentUtteranceObj = u;

    u.onend = () => {
        // Unhighlight
        unhighlightSentence(item.elementId);
        
        if (isTTSPlaying && !isTTSPaused) {
            ttsIndex++;
            speakNextSentence();
        }
    };

    u.onerror = (e) => {
        console.error("TTS Error", e);
        // Skip
        unhighlightSentence(item.elementId);
        ttsIndex++;
        speakNextSentence();
    };

    window.speechSynthesis.speak(u);
}

function pauseTTS() {
    if (isTTSPlaying) {
        window.speechSynthesis.pause();
        isTTSPaused = true;
        updatePlayButtonUI(false); // Show Play Icon
    }
}

function resumeTTS() {
    if (isTTSPaused) {
        // verify if we can resume directly or need logic
        // window.speechSynthesis.resume() works but visual sync logic relies on onend.
        // onend should still fire after resume.
        window.speechSynthesis.resume();
        isTTSPaused = false;
        updatePlayButtonUI(true); // Show Pause Icon
    }
}

function cancelTTS() {
    window.speechSynthesis.cancel();
    isTTSPlaying = false;
    isTTSPaused = false;
    // Reset all highlights
    document.querySelectorAll('.tts-sentence.active').forEach(el => el.classList.remove('active'));
    updatePlayButtonUI(false);
}

function highlightSentence(id) {
    // Dim all? Already dimmed by default CSS.
    // Just activate current.
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function unhighlightSentence(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

function updatePlayButtonUI(isPlaying) {
    const btnPlay = document.getElementById('radio-play-btn');
    if (!btnPlay) return;
    
    if (isPlaying) {
        btnPlay.classList.add('playing');
        const playIcon = btnPlay.querySelector('.play-icon');
        const pauseIcon = btnPlay.querySelector('.pause-icon');
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
    } else {
        btnPlay.classList.remove('playing');
        const playIcon = btnPlay.querySelector('.play-icon');
        const pauseIcon = btnPlay.querySelector('.pause-icon');
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
    }
}

// --- Modified Logic for AI & Controls ---

async function handleRadioChannelChange(newTheme, force = false) {
    if (!force && newTheme === currentRadioTheme) return; // Ignore if same channel unless forced

    currentRadioTheme = newTheme;
    
    // Stop Playback/TTS if playing immediately on channel switch
    cancelTTS();
    
    const btnPlay = document.getElementById('radio-play-btn');
    
    // Set Loading State
    btnPlay.classList.remove('playing');
    const playIcon = btnPlay.querySelector('.play-icon');
    const pauseIcon = btnPlay.querySelector('.pause-icon');
    const loader = btnPlay.querySelector('.loading-icon') || createLoaderIcon(btnPlay);
    
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'none';
    loader.style.display = 'block';
    
    isRadioLoading = true;
    btnPlay.style.pointerEvents = 'none'; 
    
    // Fetch Script
    await generatePodcastScript(newTheme);
    
    // Done Loading
    isRadioLoading = false;
    btnPlay.style.pointerEvents = 'auto';
    loader.style.display = 'none';
    playIcon.style.display = 'block';
}

function createLoaderIcon(parent) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('class', 'loading-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', 'white');
    svg.innerHTML = '<path d="M12 4V2C6.48 2 2 6.48 2 12H4C4 7.58 7.58 4 12 4Z"/>';
    parent.appendChild(svg);
    return svg;
}

// [Old generatePodcastScript definition removed]

// --- MOCK SCRIPTS ---
const MOCK_SCRIPTS = {
    'Productivity': `
[Intro]
Welcome back to your Productivity boost. Today we are focusing on streamlining your workflow for maximum efficiency.
[Body]
Let's look at your current tasks. You have a few meetings lined up and a project deadline approaching.
To handle this, try the time-blocking method. allocating specific hours for deep work can significantly reduce context switching.
Remember to take short breaks to keep your mind fresh.
[Outro]
Stay focused and conquer your day. You have the tools to succeed.
`,
    'Focus': `
[Intro]
Enter the zone of deep focus. This session is designed to eliminate distractions and enhance concentration.
[Body]
Your notes mention a need for clarity on the upcoming project.
Let's prioritize the most critical task first. Close unrelated tabs and put your phone on silence.
Visualizing the end result can also provide the motivation needed to start.
[Outro]
Keep this momentum going. Your ability to focus is your superpower.
`,
    'Daily Flow': `
[Intro]
Hello and welcome to your Daily Flow. Let's get in sync with your rhythm for today.
[Body]
It seems like a balanced day ahead. You have a mix of creative work and administrative duties.
Try to tackle the creative tasks when your energy is highest.
Transition smoothly between tasks by taking a moment to breathe and reset.
[Outro]
Flow through your day with ease. You are doing great.
`,
    'Discovery': `
[Intro]
Welcome to Discovery. It is time to explore new ideas and broaden your horizons.
[Body]
Your notes suggest an interest in learning a new skill.
Why not dedication twenty minutes today to research or practice?
Small, consistent steps lead to big discoveries over time.
Keep an open mind and see where your curiosity takes you.
[Outro]
Adventure awaits in every new piece of knowledge. Enjoy the journey.
`,
    'Entertainment': `
[Intro]
Time to unwind with Entertainment. Let's take a break and recharge your batteries.
[Body]
You have been working hard, so you deserve some leisure time.
Maybe catch up on that show you've been watching or listen to your favorite album.
Relaxation is a key part of productivity, so don't feel guilty about resting.
[Outro]
Enjoy your downtime. You will come back stronger.
`
};

async function generatePodcastScript(theme) {
    console.log("generatePodcastScript started for theme:", theme);
    // ... existing ...
    const sessionData = sessionStorage.getItem('tempsession');
    const contentDiv = document.getElementById('podcast-content');
    
    // Always clear content first and show loader
    if(contentDiv) contentDiv.innerHTML = '<div class="script-loader"><div class="script-spinner"></div></div>';
    else console.error("contentDiv not found!");

    if (!sessionData) {
        console.log("No session data, proceed with generic mock.");
    }

    try {
        console.log(`[Mock Status] Generating script for Theme: ${theme}`);
        
        // Simulate API Loading Delay
        await new Promise(resolve => setTimeout(resolve, 2500)); // 2.5s delay
        
        console.log("Mock delay finished");

        // Get Mock Text
        let text = MOCK_SCRIPTS[theme] || MOCK_SCRIPTS['Daily Flow'];
        
        // --- Process the Text (Same Logic as before) ---
        let htmlBuffer = '';
        let sentencesForTTS = [];
        let sentenceCounter = 0;
        
        const lines = text.split('\n');
        let currentHeader = null;
        let currentTextBuffer = '';
        
        const flushBuffer = () => {
            if (!currentTextBuffer.trim()) return;
            
            // Process the accumulated text
            const result = processTextForTTS(currentTextBuffer, sentenceCounter);
            
            // Wrap in section wrapper
            if (currentHeader) {
                const headerId = `tts-header-${sentenceCounter++}`; 
                
                // Add Header to TTS Queue
                sentencesForTTS.push({
                    text: currentHeader,
                    elementId: headerId
                });

                htmlBuffer += `<div class="script-section">
                    <span id="${headerId}" class="script-label">${currentHeader}</span>
                    <div class="script-text">${result.html}</div>
                </div>`;
                
                currentHeader = null; 
            } else {
                htmlBuffer += `<div class="script-text" style="margin-bottom:20px;">${result.html}</div>`;
            }
            
            sentencesForTTS.push(...result.queue);
            sentenceCounter = result.nextCounter;
            currentTextBuffer = '';
        };
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            const headerMatch = line.match(/^\[(.*?)\]/);
            if (headerMatch) {
                flushBuffer();
                currentHeader = headerMatch[1]; 
                const remainder = line.slice(headerMatch[0].length).trim();
                if (remainder) currentTextBuffer += remainder + ' ';
            } else {
                currentTextBuffer += line + ' ';
            }
        });
        
        // Final Flush
        flushBuffer();
        
        if(contentDiv) contentDiv.innerHTML = htmlBuffer;
        else console.error("contentDiv missing on finish");
        
        // Scroll Reset
        const face = document.getElementById('podcast-face');
        if (face) {
            face.scrollTop = 0;
            requestAnimationFrame(() => {
                face.scrollTop = 0;
            });
        }

        prepareTTS(sentencesForTTS);
        console.log("Podcast generation complete");
        
    } catch (e) {
        console.error("Script Gen Error:", e);
        if(contentDiv) contentDiv.innerHTML = `<div style="padding:20px; color:#606060;">
            Script generation failed.<br>
            Please try again.
        </div>`;
    }
}

function processTextForTTS(text, startIdNum) {
    // Split into sentences using Regex
    // Look for punctuation followed by space or end of string
    // This is simple approximation
    const rawSentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    
    let html = '';
    let queue = [];
    let counter = startIdNum;
    
    rawSentences.forEach(s => {
        if (!s.trim()) return;
        const id = `tts-sent-${counter++}`;
        html += `<span id="${id}" class="tts-sentence">${s} </span>`;
        queue.push({
            text: s.trim(),
            elementId: id
        });
    });
    
    return { html, queue, nextCounter: counter };
}

// Update Play Click for TTS
// In initTuner, replace the btnPlay.onclick
function bindPlayButton() {
     const btnPlay = document.getElementById('radio-play-btn');
     if (!btnPlay) return;
     
     btnPlay.onclick = () => {
         if (isRadioLoading) return;
         toggleTTS();
     };
}


function animateSnap(targetX) {
    if (isRadioDragging) return;
    
    const diff = targetX - radioCurrentX;
    if (Math.abs(diff) < 0.5) {
        radioCurrentX = targetX;
        updateRadioPosition(radioCurrentX);
        
        // --- ADDED: Update Channel on Snap Finish ---
        // Calculate the snapped index
        let index = Math.round((-radioCurrentX - radioItemWidth/2) / radioItemWidth);
        const channelIdx = ((index % radioChannels.length) + radioChannels.length) % radioChannels.length;
        const channelName = radioChannels[channelIdx];
        
        // Trigger Update if changed
        if (channelName !== currentRadioTheme) {
            handleRadioChannelChange(channelName);
        }
        // ---------------------------------------------
        
        return; // Done
    }
    
    radioCurrentX += diff * 0.15; // Ease factor
    updateRadioPosition(radioCurrentX);
    radioRafId = requestAnimationFrame(() => animateSnap(targetX));
}

function updateRadioPosition(x) {
    const track = document.getElementById('radio-track');
    if(track) track.style.transform = `translateX(${x}px)`;
    radioCurrentX = x; // Ensure global var tracks visual
    updateActiveRadioItem();
}

function updateActiveRadioItem() {
    // Center of track logic:
    // Needle is at visual center. 
    // Track element is shifted by `x`. 
    // The point on track under needle is `-x`.
    
    // Item i spans [i*W, (i+1)*W].
    // We want to find i where center i*W + W/2 is closest to -x.
    
    if (!tunerItems.length) return;
    
    const centerPoint = -radioCurrentX; 
    
    // To handle infinite loop visuals smoothly, we need to map the "Physical Index" (0 to 25 items) 
    // back to "Logical Index" (0 to 4 channels).
    
    let bestIndex = -1;
    let minDist = Infinity;
    
    // Optimization: Calculate hypothetical index
    // i = (center - W/2)/W
    const approxIndex = Math.round((centerPoint - radioItemWidth/2) / radioItemWidth);
    
    // Check neighbors of approxIndex only
    tunerItems.forEach((item, i) => {
        // Only checking valid items, though array is small
        if (Math.abs(i - approxIndex) < 2) {
            item.classList.add('active'); // Temporarily add to check style? No.
            // Actually just calculate distance center to center
            const itemCenter = i * radioItemWidth + radioItemWidth/2;
            const dist = Math.abs(itemCenter - centerPoint);
            if (dist < minDist) {
                minDist = dist;
                bestIndex = i;
            }
        }
    });

    tunerItems.forEach((item, i) => {
        if (i === bestIndex) item.classList.add('active');
        else item.classList.remove('active');
    });
}

function snapRadioToNearest() {
    // Deprecated for Smooth Snap
    snapRadioToNearestSmooth();
}

// Initialize Tuner on Load
initTuner();


// --- Hashtag Drag Scroll Logic ---
// keywordsContainer is defined globally at top
let isHashDragging = false;
let hashStartX, hashScrollLeft;

if (keywordsContainer) {
    keywordsContainer.addEventListener('mousedown', (e) => {
        isHashDragging = true;
        keywordsContainer.classList.add('active');
        hashStartX = e.pageX - keywordsContainer.offsetLeft;
        hashScrollLeft = keywordsContainer.scrollLeft;
    });

    keywordsContainer.addEventListener('mouseleave', () => {
        isHashDragging = false;
        keywordsContainer.classList.remove('active');
    });

    keywordsContainer.addEventListener('mouseup', () => {
        isHashDragging = false;
        keywordsContainer.classList.remove('active');
    });

    keywordsContainer.addEventListener('mousemove', (e) => {
        if (!isHashDragging) return;
        e.preventDefault();
        const x = e.pageX - keywordsContainer.offsetLeft;
        const walk = (x - hashStartX) * 1.5; // Scroll-fast
        keywordsContainer.scrollLeft = hashScrollLeft - walk;
    });
}


function onDoneClick() {
    stopAction();
    
    // 1. Save to Session Storage (Temporary container)
    // User requested "automtically disappear if page closed" -> sessionStorage is perfect.
    // Also "tempsession.json" was created in the directory as a placeholder.
    
    const exportData = {
        date: new Date().toISOString(),
        blocks: transcriptBlocks.map(b => ({
            startTime: b.startTime,
            endTime: b.endTime,
            text: b.text.trim()
        })),
        fullText: transcriptBlocks.map(b => b.text).join(' ').trim()
    };
    
    // Append active block if exists
    if (activeTranscriptBlock) {
        exportData.blocks.push({
            startTime: activeTranscriptBlock.startTime,
            endTime: activeTranscriptBlock.endTime || currentTime,
            text: activeTranscriptBlock.text.trim()
        });
        exportData.fullText += " " + activeTranscriptBlock.text.trim();
    }
    
    // Save to "tempsession" container
    sessionStorage.setItem('tempsession', JSON.stringify(exportData));
    console.log("Saved to tempsession (sessionStorage). Data will vanish on close.");
    
    // 2. Flip the 3 Boxes (Visual Effect)
    const boxes = [
        document.getElementById('prompt-box'),
        document.querySelector('.top-box'),
        document.querySelector('.centered-box')
    ];
    
    boxes.forEach(b => {
        if(b) b.classList.add('flipped-state');
    });

    // 3. Trigger initial AI Script Generation for current radio theme
    // We assume the tuner is initialized and standing on 'Productivity' (or whatever default)
    // currentRadioTheme was set in initTuner
    // FORCE update even if theme hasn't changed (since this is the first generation event)
    handleRadioChannelChange(currentRadioTheme || 'Productivity', true);
}

function onDeleteClick() {
    if (confirm("Delete recording?")) {
        stopAction();
        recordedSamples = [];
        audioBuffer = null;
        currentTime = 0;
        duration = 0;

        // Clear Transcript/Text Data
        transcriptBlocks = [];
        activeTranscriptBlock = null;
        interimTranscript = "";
        
        // Clear Keywords UI
        const kContainer = document.getElementById('keywords-container');
        if(kContainer) kContainer.innerHTML = '';

        // Update UI (will clear text display and hide Done button)
        updateTranscriptUI();

        updateState(STATE.IDLE);
        draw();
        updateTimeDisplay();
    }
}

function updateState(newState) {
    currentState = newState;
    
    // Default Defaults
    btnRecord.classList.remove('recording');
    btnRecord.style.display = 'block';
    
    // Hide Playback controls by default
    playbackWrapper.style.display = 'none';
    btnPlay.style.display = 'none';
    btnPause.style.display = 'none';
    
    // Visibility logic: Show Delete/Done only if we have data (Review mode)
    // Hidden in IDLE (no data) and RECORDING (focus on stop)
    const canInteract = (newState === STATE.REVIEW_PAUSED || newState === STATE.REVIEW_PLAYING);
    const visibleStyle = canInteract ? 'visible' : 'hidden';
    
    btnDelete.style.visibility = visibleStyle;
    btnDone.style.visibility = visibleStyle;

    switch (newState) {
        case STATE.IDLE:
             break;
        case STATE.RECORDING:
            btnRecord.classList.add('recording');
            // Explicitly ensure hidden during recording
            btnDelete.style.visibility = 'hidden';
            btnDone.style.visibility = 'hidden';
            break;
        case STATE.REVIEW_PAUSED:
            // Show Play button. Record button stays in center.
            playbackWrapper.style.display = 'block';
            btnPlay.style.display = 'block';
            
            // Revert record button style if needed (it stays as standard record button)
            // btnRecord.style.transform = 'scale(1)'; 
            break;
        case STATE.REVIEW_PLAYING:
            playbackWrapper.style.display = 'block';
            btnPause.style.display = 'block';
            break;
    }
}

function updateTimeDisplay() {
    const t = Math.max(0, currentTime);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    timeDisplay.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;
}

// --- Interaction: Scrubbing/Dragging ---
let isDragging = false;
let dragStartX = 0;
let dragStartTime = 0;

// Snapping Logic
function getSnapPoints() {
    let points = [0, duration];
    transcriptBlocks.forEach(b => {
        points.push(b.startTime);
        if (b.endTime) points.push(b.endTime);
    });
    // Remove Duplicates and Sort
    return [...new Set(points)].sort((a,b) => a - b);
}

function snapToClosest(time) {
    const points = getSnapPoints();
    if (points.length === 0) return time;
    
    // Threshold: 0.2 seconds (approx 20px). 
    // If distance to closest point is > threshold, don't snap.
    const SNAP_THRESHOLD = 0.2;
    
    let closest = points[0];
    let minDiff = Math.abs(time - closest);
    
    for (let i = 1; i < points.length; i++) {
        const diff = Math.abs(time - points[i]);
        if (diff < minDiff) {
            minDiff = diff;
            closest = points[i];
        }
    }
    
    if (minDiff <= SNAP_THRESHOLD) {
        return closest;
    }
    return time;
}

function onPointerDown(e) {
    if (currentState === STATE.RECORDING) return;
    
    // Stop playback if playing
    if (currentState === STATE.REVIEW_PLAYING) {
        if (sourceNode) {
            try { sourceNode.stop(); } catch(e){}
        }
        updateState(STATE.REVIEW_PAUSED);
    }
    
    // Calculate raw time from click
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const center = rect.width / 2;
    const dt = (clickX - center) / PX_PER_SECOND;
    let rawTime = currentTime + dt;
    
    // Apply Snapping
    let newTime = snapToClosest(rawTime);
    
    // Clamp
    newTime = Math.max(0, Math.min(newTime, duration));
    currentTime = newTime;
    
    draw();
    updateTimeDisplay();
    updateTextCursor(currentTime);

    isDragging = true;
    dragStartX = e.clientX;
    dragStartTime = currentTime; // Start from the SNAPPED time
    
    container.setPointerCapture(e.pointerId);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    
    const dt = -dx / PX_PER_SECOND;
    let rawTime = dragStartTime + dt;
    
    // Apply Snapping during drag
    let newTime = snapToClosest(rawTime);
    newTime = Math.max(0, Math.min(newTime, duration));
    
    currentTime = newTime;
    updateTimeDisplay();
    draw();
    updateTextCursor(currentTime);
}

function onPointerUp(e) {
    isDragging = false;
    container.releasePointerCapture(e.pointerId);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
}


// --- Rendering: The Scrolling Waveform ---

function draw() {
    // Canvas dimensions (logical)
    const cw = canvas.width / (window.devicePixelRatio||1);
    const ch = canvas.height / (window.devicePixelRatio||1);
    
    ctx.clearRect(0, 0, cw, ch);
    
    // Draw Center Line (Guides)? 
    // Actually Playhead div handles the center line.
    
    if (recordedSamples.length === 0) return;

    // We need to determine which samples are visible.
    // Center of screen is `currentTime`.
    // Left of screen is `currentTime - (cw/2)/PX_PER_SECOND`.
    // Right of screen is `currentTime + (cw/2)/PX_PER_SECOND`.
    
    // How many samples per pixel?
    // PPS = 100. SampleRate = 44100.
    // Samples Per Pixel = 44100 / 100 = 441.
    const samplesPerPixel = sampleRate / PX_PER_SECOND;
    
    // Optimization: Draw Bars.
    // Bar Stride = 5px (3px bar + 2px gap).
    // Samples Per Bar = samplesPerPixel * BAR_STRIDE.
    const samplesPerBar = samplesPerPixel * BAR_STRIDE;
    
    // Calculate start Bar Index relative to time 0
    const centerBarIndex = (currentTime * sampleRate) / samplesPerBar;
    
    // Visual width in bars
    const visibleBars = Math.ceil(cw / BAR_STRIDE) + 2; 
    
    // We iterate roughly from -visibleBars/2 to +visibleBars/2 around centerBarIndex
    const startOffsetCalls = Math.floor(centerBarIndex - visibleBars/2);
    const endOffsetCalls = Math.ceil(centerBarIndex + visibleBars/2);
    
    ctx.fillStyle = currentState === STATE.RECORDING ? '#FF3B30' : 'white';
    
    // If reviewing, we might want grey for future, blue for past?
    // iPhone style: The whole waveform is black/white/red. The playhead is static.
    // Let's stick to White for waveform.
    
    for (let i = startOffsetCalls; i <= endOffsetCalls; i++) {
        if (i < 0) continue;
        
        // Map Bar Index i to Sample Index in recordedSamples
        const sampleIdxStart = Math.floor(i * samplesPerBar);
        const sampleIdxEnd = Math.floor((i + 1) * samplesPerBar);
        
        if (sampleIdxStart >= recordedSamples.length) break;
        
        // Find RMS/Max in this chunk
        let sum = 0;
        let count = 0;
        // Simple optimization: don't loop huge chunks if zoomed out too much (not an issue here)
        for (let j = sampleIdxStart; j < sampleIdxEnd; j++) {
            if (j >= recordedSamples.length) break;
            sum += Math.abs(recordedSamples[j]);
            count++;
        }
        const avg = count > 0 ? sum / count : 0;
        
        // Scale height
        // Non-linear boost for visibility
        // USER REQUEST: Waveform is too small. 
        // Boosting sensitivity significantly. 
        // Using Math.sqrt to boost lower volumes (compress dynamic range visually)
        // USER REQUEST: 3x fluctuation/variation rate. 1.5 -> 4.5
        const boostedAvg = Math.sqrt(avg); 
        const barHeight = Math.max(BAR_WIDTH, (boostedAvg * ch * 4.5)); 
        
        // Calculate X position
        // Center of screen is X = cw/2.
        // This bar's time center is `i * samplesPerBar / SR`.
        // Delta Time = BarTime - CurrentTime.
        // Delta X = Delta Time * PX_PER_SECOND.
        // X = cw/2 + Delta X.
        
        const barTime = (i * samplesPerBar) / sampleRate;
        const deltaTime = barTime - currentTime;
        const xPos = (cw / 2) + (deltaTime * PX_PER_SECOND);
        
        // Check bounds again just in case
        if (xPos < -BAR_STRIDE || xPos > cw + BAR_STRIDE) continue;
        
        const roundedH = Math.min(barHeight, ch * 0.9);
        const yPos = (ch - roundedH) / 2;
        
        // Color logic
        // If in recording mode: Red.
        // If in review mode: Darker gray for played, Lighter gray for future ("That Gray")
        
        if (currentState !== STATE.RECORDING) {
            if (barTime < currentTime) {
                // Past/Played
                ctx.fillStyle = '#666666'; 
            } else {
                // Future/Unplayed
                 ctx.fillStyle = '#AAAAAA';
            }
        }
        
        // USER REQUEST: Rounder edges (larger radius). 
        // Using `width` as radius makes it fully round (pill shape).
        ctx.beginPath();
        ctx.roundRect(xPos, yPos, BAR_WIDTH, roundedH, 50);
        ctx.fill();
    }
}
