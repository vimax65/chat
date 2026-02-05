// تنظیمات
const SIGNALING_SERVER_URL = window.location.hostname.includes('localhost') 
    ? 'ws://localhost:3001' 
    : `wss://${window.location.hostname}/api`;

// متغیرهای جهانی
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let signalingSocket = null;
let localId = null;
let remoteId = null;
let isInCall = false;

// المنت‌های DOM
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleVideoBtn = document.getElementById('toggleVideo');
const toggleAudioBtn = document.getElementById('toggleAudio');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const localIdInput = document.getElementById('localId');
const remoteIdInput = document.getElementById('remoteIdInput');
const copyIdButton = document.getElementById('copyIdButton');
const connectButton = document.getElementById('connectButton');
const createIdButton = document.getElementById('createIdButton');
const testSignalButton = document.getElementById('testSignalButton');
const connectionStatus = document.getElementById('connectionStatus');
const connectionCount = document.getElementById('connectionCount');

// تنظیمات اولیه
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// مقداردهی اولیه برنامه
async function initializeApp() {
    try {
        // تولید ID منحصر به فرد
        generateLocalId();
        
        // اتصال به سرور سیگنالینگ
        await connectToSignalingServer();
        
        // دریافت دسترسی به دوربین و میکروفون
        await requestMediaPermissions();
        
        updateConnectionStatus('connected-to-server');
        addSystemMessage('برنامه آماده استفاده است. ID خود را با شخص مقابل به اشتراک بگذارید.');
    } catch (error) {
        console.error('خطا در مقداردهی اولیه:', error);
        addSystemMessage('خطا در راه‌اندازی برنامه. لطفاً صفحه را رفرش کنید.', 'error');
    }
}

// اتصال به سرور سیگنالینگ WebSocket
async function connectToSignalingServer() {
    return new Promise((resolve, reject) => {
        signalingSocket = new WebSocket(SIGNALING_SERVER_URL);
        
        signalingSocket.onopen = () => {
            console.log('Connected to signaling server');
            
            // ثبت کاربر در سرور
            signalingSocket.send(JSON.stringify({
                type: 'register',
                userId: localId
            }));
            
            resolve();
        };
        
        signalingSocket.onmessage = handleSignalingMessage;
        
        signalingSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            reject(error);
        };
        
        signalingSocket.onclose = () => {
            console.log('Disconnected from signaling server');
            updateConnectionStatus('disconnected');
            addSystemMessage('اتصال به سرور قطع شد. لطفاً دوباره تلاش کنید.', 'error');
            
            // تلاش مجدد بعد از 5 ثانیه
            setTimeout(() => {
                if (!signalingSocket || signalingSocket.readyState === WebSocket.CLOSED) {
                    connectToSignalingServer();
                }
            }, 5000);
        };
    });
}

// پردازش پیام‌های سرور
function handleSignalingMessage(event) {
    try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'registered':
                console.log('Registered successfully');
                updateConnectionStatus('ready');
                break;
                
            case 'offer':
                handleOffer(data);
                break;
                
            case 'answer':
                handleAnswer(data);
                break;
                
            case 'candidate':
                handleCandidate(data);
                break;
                
            case 'message':
                handleIncomingMessage(data);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error processing signaling message:', error);
    }
}

// تولید ID محلی
function generateLocalId() {
    const adjectives = ['شاد', 'باهوش', 'مهربان', 'قوی', 'زیبا', 'خلاق', 'پرانرژی', 'دوست‌داشتنی'];
    const nouns = ['پنجره', 'ستاره', 'کوه', 'دریا', 'ابر', 'خورشید', 'ماه', 'گل'];
    
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(Math.random() * 100);
    
    localId = `${randomAdj}-${randomNoun}-${randomNum}`;
    localIdInput.value = localId;
}

// درخواست دسترسی به دوربین و میکروفون
async function requestMediaPermissions() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }, 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        localVideo.srcObject = localStream;
        
        // فعال کردن کنترل‌ها
        toggleVideoBtn.disabled = false;
        toggleAudioBtn.disabled = false;
        callButton.disabled = false;
        
        addSystemMessage('دسترسی به دوربین و میکروفون با موفقیت دریافت شد.');
    } catch (error) {
        console.error('خطا در دسترسی به دوربین/میکروفون:', error);
        addSystemMessage('خطا در دسترسی به دوربین یا میکروفون. لطفاً دسترسی‌ها را بررسی کنید.', 'error');
        
        // حالت شبیه‌سازی برای توسعه
        localVideo.srcObject = null;
        localVideo.style.backgroundColor = '#333';
    }
}

// راه‌اندازی شنود رویدادها
function setupEventListeners() {
    // کنترل‌های ویدئو/صدا
    toggleVideoBtn.addEventListener('click', toggleVideo);
    toggleAudioBtn.addEventListener('click', toggleAudio);
    callButton.addEventListener('click', initiateCall);
    hangupButton.addEventListener('click', hangUpCall);
    
    // کنترل‌های چت
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // کنترل‌های اتصال
    copyIdButton.addEventListener('click', copyLocalId);
    connectButton.addEventListener('click', connectToRemote);
    createIdButton.addEventListener('click', () => {
        generateLocalId();
        signalingSocket.send(JSON.stringify({
            type: 'register',
            userId: localId
        }));
        addSystemMessage('ID جدید ایجاد شد.');
    });
    
    testSignalButton.addEventListener('click', testSignalingServer);
    
    remoteIdInput.addEventListener('input', () => {
        const remoteIdValue = remoteIdInput.value.trim();
        connectButton.disabled = !remoteIdValue || remoteIdValue === localId;
    });
}

// خاموش/روشن کردن دوربین
function toggleVideo() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoBtn.classList.toggle('active', !videoTrack.enabled);
        toggleVideoBtn.innerHTML = videoTrack.enabled ? 
            '<i class="fas fa-video"></i>' : 
            '<i class="fas fa-video-slash"></i>';
        
        addSystemMessage(`دوربین ${videoTrack.enabled ? 'روشن' : 'خاموش'} شد.`);
    }
}

// خاموش/روشن کردن میکروفون
function toggleAudio() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioBtn.classList.toggle('active', !audioTrack.enabled);
        toggleAudioBtn.innerHTML = audioTrack.enabled ? 
            '<i class="fas fa-microphone"></i>' : 
            '<i class="fas fa-microphone-slash"></i>';
        
        addSystemMessage(`میکروفون ${audioTrack.enabled ? 'روشن' : 'خاموش'} شد.`);
    }
}

// آغاز تماس
async function initiateCall() {
    if (!remoteIdInput.value.trim()) {
        addSystemMessage('لطفاً ID کاربر مقابل را وارد کنید.', 'error');
        return;
    }
    
    remoteId = remoteIdInput.value.trim();
    
    if (remoteId === localId) {
        addSystemMessage('نمی‌توانید با خودتان تماس بگیرید!', 'error');
        return;
    }
    
    addSystemMessage(`در حال برقراری تماس با ${remoteId}...`);
    updateConnectionStatus('calling');
    
    // ایجاد اتصال peer-to-peer
    createPeerConnection();
    
    // اضافه کردن جریان محلی به اتصال
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    try {
        // ایجاد offer
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        
        await peerConnection.setLocalDescription(offer);
        
        // ارسال offer به کاربر مقابل از طریق سرور سیگنالینگ
        signalingSocket.send(JSON.stringify({
            type: 'offer',
            target: remoteId,
            offer: offer
        }));
        
    } catch (error) {
        console.error('خطا در ایجاد تماس:', error);
        addSystemMessage('خطا در برقراری تماس.', 'error');
        updateConnectionStatus('ready');
    }
}

// قطع تماس
function hangUpCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    
    isInCall = false;
    remoteId = null;
    updateConnectionStatus('ready');
    addSystemMessage('تماس قطع شد.');
    
    // غیرفعال کردن دکمه قطع تماس
    hangupButton.disabled = true;
    callButton.disabled = false;
}

// ایجاد اتصال PeerConnection
function createPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // مدیریت جریان از راه دور
    peerConnection.ontrack = (event) => {
        if (!remoteVideo.srcObject) {
            remoteStream = event.streams[0];
            remoteVideo.srcObject = remoteStream;
            isInCall = true;
            updateConnectionStatus('connected');
            addSystemMessage('تماس برقرار شد! می‌توانید صحبت کنید.');
            
            // فعال کردن دکمه قطع تماس و غیرفعال کردن دکمه تماس
            hangupButton.disabled = false;
            callButton.disabled = true;
        }
    };
    
    // مدیریت نامزدهای ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && remoteId) {
            signalingSocket.send(JSON.stringify({
                type: 'candidate',
                target: remoteId,
                candidate: event.candidate
            }));
        }
    };
    
    // مدیریت تغییرات وضعیت اتصال
    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection) {
            console.log('ICE connection state:', peerConnection.iceConnectionState);
            
            switch (peerConnection.iceConnectionState) {
                case 'failed':
                case 'disconnected':
                case 'closed':
                    if (isInCall) {
                        addSystemMessage('اتصال قطع شد.', 'error');
                        hangUpCall();
                    }
                    break;
            }
        }
    };
}

// پردازش offer دریافتی
async function handleOffer(data) {
    if (isInCall) {
        // اگر در حال حاضر در تماس هستیم، تماس جدید را رد می‌کنیم
        return;
    }
    
    remoteId = data.from;
    addSystemMessage(`دریافت درخواست تماس از ${remoteId}...`);
    updateConnectionStatus('incoming-call');
    
    // ایجاد اتصال peer-to-peer
    createPeerConnection();
    
    // اضافه کردن جریان محلی به اتصال
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    try {
        // تنظیم offer دریافتی
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // ایجاد پاسخ
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // ارسال پاسخ به کاربر مقابل
        signalingSocket.send(JSON.stringify({
            type: 'answer',
            target: remoteId,
            answer: answer
        }));
        
        updateConnectionStatus('connecting');
        
    } catch (error) {
        console.error('خطا در پاسخ به تماس:', error);
        addSystemMessage('خطا در برقراری تماس.', 'error');
        updateConnectionStatus('ready');
    }
}

// پردازش answer دریافتی
async function handleAnswer(data) {
    if (!peerConnection || !peerConnection.remoteDescription) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (error) {
            console.error('خطا در تنظیم answer:', error);
        }
    }
}

// پردازش candidate دریافتی
async function handleCandidate(data) {
    if (peerConnection && peerConnection.remoteDescription) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('خطا در اضافه کردن ICE candidate:', error);
        }
    }
}

// اتصال به کاربر مقابل (تنظیم remoteId)
function connectToRemote() {
    if (!remoteIdInput.value.trim()) {
        addSystemMessage('لطفاً ID کاربر مقابل را وارد کنید.', 'error');
        return;
    }
    
    remoteId = remoteIdInput.value.trim();
    
    if (remoteId === localId) {
        addSystemMessage('نمی‌توانید با خودتان تماس بگیرید!', 'error');
        return;
    }
    
    addSystemMessage(`آماده دریافت تماس از ${remoteId} هستید.`);
    updateConnectionStatus('waiting');
}

// کپی ID محلی
function copyLocalId() {
    localIdInput.select();
    document.execCommand('copy');
    
    // نمایش تأیید
    const originalText = copyIdButton.innerHTML;
    copyIdButton.innerHTML = '<i class="fas fa-check"></i> کپی شد!';
    copyIdButton.style.background = '#2ecc71';
    
    setTimeout(() => {
        copyIdButton.innerHTML = originalText;
        copyIdButton.style.background = '';
    }, 2000);
    
    addSystemMessage('ID شما کپی شد.');
}

// ارسال پیام در چت
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !remoteId) return;
    
    // نمایش پیام در چت محلی
    addMessageToChat(message, localId, 'local');
    
    // ارسال پیام به کاربر مقابل از طریق سرور سیگنالینگ
    signalingSocket.send(JSON.stringify({
        type: 'message',
        target: remoteId,
        message: message
    }));
    
    // پاک کردن فیلد ورودی
    messageInput.value = '';
}

// پردازش پیام دریافتی
function handleIncomingMessage(data) {
    addMessageToChat(data.message, data.from, 'remote');
}

// اضافه کردن پیام به چت
function addMessageToChat(message, sender, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    const senderElement = document.createElement('div');
    senderElement.className = 'message-sender';
    senderElement.innerHTML = `<i class="fas fa-user"></i> ${type === 'local' ? 'شما' : sender}`;
    
    const textElement = document.createElement('div');
    textElement.textContent = message;
    
    messageElement.appendChild(senderElement);
    messageElement.appendChild(textElement);
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// اضافه کردن پیام سیستم
function addSystemMessage(message, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-system ${type}`;
    
    const icon = type === 'error' ? 'exclamation-triangle' : 'info-circle';
    messageElement.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// به‌روزرسانی وضعیت اتصال
function updateConnectionStatus(status) {
    connectionStatus.className = 'status';
    
    switch(status) {
        case 'connected-to-server':
            connectionStatus.classList.add('connecting');
            connectionStatus.innerHTML = '<i class="fas fa-wifi"></i> متصل به سرور';
            break;
            
        case 'ready':
            connectionStatus.classList.add('connected');
            connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> آماده برای تماس';
            break;
            
        case 'calling':
            connectionStatus.classList.add('connecting');
            connectionStatus.innerHTML = '<i class="fas fa-phone-volume"></i> در حال برقراری تماس...';
            break;
            
        case 'waiting':
            connectionStatus.classList.add('connecting');
            connectionStatus.innerHTML = '<i class="fas fa-clock"></i> در انتظار تماس کاربر مقابل...';
            break;
            
        case 'incoming-call':
            connectionStatus.classList.add('connecting');
            connectionStatus.innerHTML = `<i class="fas fa-phone"></i> درخواست تماس از ${remoteId}`;
            break;
            
        case 'connecting':
            connectionStatus.classList.add('connecting');
            connectionStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> در حال برقراری ارتباط...';
            break;
            
        case 'connected':
            connectionStatus.classList.add('connected');
            connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> متصل به کاربر مقابل';
            break;
            
        case 'disconnected':
            connectionStatus.classList.add('disconnected');
            connectionStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> قطع ارتباط';
            break;
    }
}

// تست سرور سیگنالینگ
function testSignalingServer() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        addSystemMessage('سرور سیگنالینگ در حال کار است.', 'info');
    } else {
        addSystemMessage('سرور سیگنالینگ در دسترس نیست.', 'error');
    }
}

// مدیریت بسته شدن صفحه
window.addEventListener('beforeunload', () => {
    if (signalingSocket) {
        signalingSocket.close();
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});