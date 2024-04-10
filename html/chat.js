const protocol = 'WEBSOCKET'; // WEBSOCKET 
const langstate = 'korean'; // korean or english
const enableTTS = true;
const enableDelayedMessage = false; // in order to manipulate the voice messages

if(enableTTS) {
    var AudioContext;
    var audioContext;

    window.onload = function() {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
        }).catch(e => {
            console.error(`Audio permissions denied: ${e}`);
        });
    }
}

// Common
let userId = localStorage.getItem('userId'); // set userID if exists 
if(userId=="") {
    userId = uuidv4();
}
console.log('userId: ', userId);

// chat session
let endpoint = localStorage.getItem('wss_url');  
if(endpoint=="") {
    console.log('provisioning is required!');
}
console.log('endpoint: ', endpoint);

let webSocket
let isConnected;
if(protocol == 'WEBSOCKET') {
    webSocket = connect(endpoint, 'initial');
} 

// voice session
let voiceEndpoint = localStorage.getItem('voice_wss_url');
if(voiceEndpoint=="") {
    console.log('voice provisioning is required!');
}
console.log('voiceEndpoint: ', voiceEndpoint);

let voiceWebSocket
let isVoiceConnected;
if(protocol == 'WEBSOCKET') {
    voiceWebSocket = voiceConnect(voiceEndpoint, 'initial');
}

console.log('feedback...');
const feedback = document.getElementById('feedback');
feedback.style.display = 'none'; 

// Hashmap
HashMap = function() {
    this.map = new Array();
};

HashMap.prototype = {
    put: function(key, value) {
        this.map[key] = value;
    },
    get: function(key) {
        return this.map[key];
    },
    size: function() {
        var keys = new Array();
        for(i in this.map) {
            keys.push(i);
        }
        return keys.length;
    },
    remove: function(key) {
        delete this.map[key];
    },
    getKeys: function() {
        var keys = new Array();
        for(i in this.map) {
            keys.push(i);
        }
        return keys;
    }
};

// messag method 
let undelivered = new HashMap();
let retry_count = 0;
function sendMessage(message) {
    if(!isConnected) {
        console.log('reconnect...'); 
        webSocket = connect(endpoint, 'reconnect');
        
        if(langstate=='korean') {
            addNotifyMessage("재연결중입니다. 연결후 자동 재전송합니다.");
        }
        else {
            addNotifyMessage("We are connecting again. Your message will be retried after connection.");                        
        }

        undelivered.put(message.request_id, message);
        console.log('undelivered message: ', message);
        
        return false
    }
    else {
        webSocket.send(JSON.stringify(message));     
        console.log('message: ', message);   

        return true;
    }     
}

// keep alive
let tm;
function ping() {
    console.log('->ping');
    webSocket.send('__ping__');
    tm = setTimeout(function () {
        console.log('reconnect...');    
        
        isConnected = false
        webSocket = connect(endpoint, 'reconnect');
        
    }, 5000);
}
function pong() {
    clearTimeout(tm);
}

let voiceTm;
function voicePing() {
    console.log('->voice ping');
    voiceWebSocket.send('__ping__');
    voiceTm = setTimeout(function () {
        console.log('voice reconnect...');    
        
        isVoiceConnected = false
        voiceWebSocket = voiceConnect(voiceEndpoint, 'reconnect');
        
    }, 5000);
}
function voicePong() {
    clearTimeout(voiceTm);
}

let retryCounter;
function checkingDelayedPlayList() {
    console.log('->checking delayed played list ('+retryCounter+')');  
    playAudioList();

    let isCompleted = true;
    for(let i=0; i<playList.length;i++) {
        if(playList[i].played == false) {
            isCompleted = false;
            break;
        }
    }
    
    if(isCompleted==true) {
        playList = [];
    } 
    else {
        playTm = setTimeout(function () {           
            retryCounter--;
    
            if(retryCounter>0) {
                checkingDelayedPlayList();
            }
        }, 1000);
    }    
}

// chat session 
let sentance = "";
let lineText = "";
let playList = [];
let current = 0;
let requestId = ""
let next = true;
let requested = new HashMap();
function connect(endpoint, type) {
    const ws = new WebSocket(endpoint);

    // connection event
    ws.onopen = function () {
        console.log('connected...');
        isConnected = true;

        if(undelivered.size() && retry_count>0) {
            let keys = undelivered.getKeys();
            console.log('retry undelived messags!');            
            console.log('keys: ', keys);
            console.log('retry_count: ', retry_count);

            for(i in keys) {
                let message = undelivered.get(keys[i])
                console.log('message', message)
                if(!sendMessage(message)) break;
                else {
                    undelivered.remove(message.request_id)
                }
            }
            retry_count--;
        }
        else {
            retry_count = 3
        }

        if(type == 'initial')
            setInterval(ping, 40000);  // ping interval: 40 seconds
    };

    // message 
    ws.onmessage = function (event) {     
        isConnected = true;   
        if (event.data.substr(1,8) == "__pong__") {
            console.log('<-pong');
            pong();
            return;
        }
        else {
            response = JSON.parse(event.data)

            if(response.status == 'completed') {     
                console.log('dialog status: completed');    
                console.log('next: ', next); 
                feedback.style.display = 'none';       
                   
                addReceivedMessage(response.request_id, response.msg);  
                // console.log('response.msg: ', response.msg);

                if(enableTTS) {
                    console.log('requested: ', requested[response.request_id]);
                    
                    if(requested[response.request_id] == undefined) {
                        requestId = response.request_id;
                        playList.push({
                            'played': false,
                            'requestId': requestId,
                            'text': response.msg
                        });
                        lineText = "";      
                    
                        loadAudio(response.request_id, response.msg);
                            
                        next = true;
                        playAudioList();
                    }
                    
                    retryCounter = 10;
                    checkingDelayedPlayList();
                    // playList = [];
                }                              
            }          
            else if(response.status == 'istyping') {
                feedback.style.display = 'inline';
                // feedback.innerHTML = '<i>typing a message...</i>'; 
                sentance = "";
            }
            else if(response.status == 'proceeding') {
                // console.log('status: proceeding...')
                feedback.style.display = 'none';
                sentance += response.msg;                
                
                addReceivedMessage(response.request_id, sentance);
                // console.log('response.msg: ', response.msg);

                if(enableTTS) {
                    lineText += response.msg;
                    lineText = lineText.replace('\n','');
                    if(lineText.length>3 && (response.msg == '.' || response.msg == '?' || response.msg == '!'|| response.msg == ':')) {     
                        console.log('lineText: ', lineText);
                        text = lineText
                        playList.push({
                            'played': false,
                            'requestId': requestId,
                            'text': text
                        });
                        lineText = "";      
            
                        requested[response.request_id] = true;
                        loadAudio(response.request_id, text);                                  
                    }
                    
                    requestId = response.request_id;
                    playAudioList();
                }
            }                
            else if(response.status == 'debug') {
                feedback.style.display = 'none';
                console.log('debug: ', response.msg);
                // addNotifyMessage(response.msg);
                addReceivedMessage(response.request_id, response.msg);  
            }          
            else if(response.status == 'error') {
                feedback.style.display = 'none';
                console.log('error: ', response.msg);

                if(response.msg.indexOf('throttlingException') || response.msg.indexOf('Too many requests') || response.msg.indexOf('too many requests')) {
                    addNotifyMessage('허용된 요청수를 초과하였습니다. 추후 다시 재시도 해주세요.');  
                }
                else {
                    addNotifyMessage(response.msg);
                }
                
            }   
        }        
    };

    // disconnect
    ws.onclose = function () {
        console.log('disconnected...!');
        isConnected = false;

        ws.close();
        console.log('the session will be closed');
    };

    // error
    ws.onerror = function (error) {
        console.log(error);
        isConnected = false;

        ws.close();
        console.log('the session will be closed');
    };

    return ws;
}

let redirectTm; // timer for redirection
let remainingRedirectedMessage;  // merge two consecutive messages in 2 seconds
let messageTransfered = new HashMap();
let messageMemory = new HashMap();   // duplication check caused by pubsub in the case of abnormal disconnection
let scoreValue = new HashMap();   // duplication check for score

function requestReDirectMessage(requestId, query, userId, requestTime, conversationType) {  
    console.log('--> send the redirected message');
        
    if(messageTransfered.get(requestId)==undefined) {
        console.log('--> sendMessage: ', query);

        next = true;  // initiate valriable 'next' for audio play        
        sendMessage({
            "user_id": userId,
            "request_id": requestId,
            "request_time": requestTime,        
            "type": "text",
            "body": query,
            "convType": conversationType
        });
        messageMemory.put(requestId, query);      
        messageTransfered.put(requestId, true);
                
        remainingRedirectedMessage = "";
    }        
}

function delayedRequestForRedirectionMessage(requestId, query, userId, requestTime, conversationType) {    
    console.log('--> start delay() of redirected message');

    remainingRedirectedMessage = {
        'timestr': requestTime,
        'requestId': requestId,
        'message': query
    }; 
    console.log('new remainingRedirectedMessage[message]: ', remainingRedirectedMessage['message']);

    redirectTm = setTimeout(function () {
        console.log('--> delayed request: ', query);
        console.log('messageTransfered[requestId] = ', messageTransfered.get(requestId));
        
        if(messageTransfered.get(requestId)==undefined) {
            console.log('--> sendMessage: ', query);

            next = true;  // initiate valriable 'next' for audio play        
            sendMessage({
                "user_id": userId,
                "request_id": requestId,
                "request_time": requestTime,        
                "type": "text",
                "body": query,
                "convType": conversationType
            });
            messageMemory.put(requestId, query);      
            messageTransfered.put(requestId, true);
                
            remainingRedirectedMessage = "";
        }
        
        clearRedirectTm();
    }, 2000);
}
function clearRedirectTm() {
    clearTimeout(redirectTm);
}

// voice session 
function voiceConnect(voiceEndpoint, type) {
    const ws_voice = new WebSocket(voiceEndpoint);

    // connection event
    ws_voice.onopen = function () {
        console.log('voice connected...');
        isVoiceConnected = true;

        // request initiation of redis
        let requestObj = {
            "user_id": userId,
            "type": "initiate"
        }
        voiceWebSocket.send(JSON.stringify(requestObj));
    
        if(type == 'initial')
            setInterval(voicePing, 40000);  // ping interval: 40 seconds
    };

    // message 
    ws_voice.onmessage = function (event) {     
        isVoiceConnected = true;   
        if (event.data.substr(1,8) == "__pong__") {
            console.log('<-voice pong');
            voicePong();
            return;
        }
        else {  // voice messages delivered from interpreter (device <-> trasncribe)
            response = JSON.parse(event.data)

             if(response.status == 'redirected') {  // voice message status == redirected
                feedback.style.display = 'none';      
                console.log('response: ', response);
                
                let msg = JSON.parse(response.msg)
                requestId = msg.requestId;
                query = msg.query;
                state = msg.state;

                console.log('requestId: ', requestId);
                console.log('query: ', query);
                console.log('voice state: ', state);

                let current = new Date();
                let datastr = getDate(current);
                let timestr = getTime(current);
                let requestTime = datastr+' '+timestr;

                console.log('remainingRedirectedMessage', remainingRedirectedMessage);    // last redirected message but not delivered

                if(state=='completed') {
                    if (remainingRedirectedMessage && requestId != remainingRedirectedMessage['requestId']) {
                        requestId = remainingRedirectedMessage['requestId']; // use the remained requestId for display
                       
                        remainingRedirectedMessage['message'] = remainingRedirectedMessage['message']+'\n'+query; // add new message
                        query = remainingRedirectedMessage['message'];
                    }

                    if(messageMemory.get(requestId)==undefined) { 
                        addSentMessage(requestId, timestr, query);

                        if(enableDelayedMessage == false) {
                            requestReDirectMessage(requestId, query, userId, requestTime, conversationType)
                        }
                        else {  // in order to manipulate voice messages where the message will be delayed for one time
                            delayedRequestForRedirectionMessage(requestId, query, userId, requestTime, conversationType);                                   
                        }
                        
                        console.log('get score for ', query);
                        if(scoreValue.get(requestId)==undefined) { // check duplication
                            getScore(userId, requestId, query); 
                            scoreValue.put(requestId, true);
                        }
                         
                    }
                    else {  
                        console.log('ignore the duplicated message: ', query);
                    }                    
                }
                else {
                    addSentMessage(requestId, timestr, query);
                }                            
            }      
            else if(response.status == 'error') {
                feedback.style.display = 'none';
                console.log('error: ', response.msg);
                addNotifyMessage(response.msg);
            }   
        }        
    };

    // disconnect
    ws_voice.onclose = function () {
        console.log('voice disconnected...!');
        isVoiceConnected = false;

        ws_voice.close();
        console.log('the voice session will be closed');
    };

    // error
    ws_voice.onerror = function (error) {
        console.log(error);
        isVoiceConnected = false;

        ws_voice.close();
        console.log('the voice session will be closed');
    };

    return ws_voice;
}

let audioData = new HashMap();
function loadAudio(requestId, text) {
    const uri = "speech";
    const xhr = new XMLHttpRequest();

    let speed = 120;
    let voiceId = 'Seoyeon';
    // voiceId: 'Aditi'|'Amy'|'Astrid'|'Bianca'|'Brian'|'Camila'|'Carla'|'Carmen'|'Celine'|'Chantal'|'Conchita'|'Cristiano'|'Dora'|'Emma'|'Enrique'|'Ewa'|'Filiz'|'Gabrielle'|'Geraint'|'Giorgio'|'Gwyneth'|'Hans'|'Ines'|'Ivy'|'Jacek'|'Jan'|'Joanna'|'Joey'|'Justin'|'Karl'|'Kendra'|'Kevin'|'Kimberly'|'Lea'|'Liv'|'Lotte'|'Lucia'|'Lupe'|'Mads'|'Maja'|'Marlene'|'Mathieu'|'Matthew'|'Maxim'|'Mia'|'Miguel'|'Mizuki'|'Naja'|'Nicole'|'Olivia'|'Penelope'|'Raveena'|'Ricardo'|'Ruben'|'Russell'|'Salli'|'Seoyeon'|'Takumi'|'Tatyana'|'Vicki'|'Vitoria'|'Zeina'|'Zhiyu'|'Aria'|'Ayanda'|'Arlet'|'Hannah'|'Arthur'|'Daniel'|'Liam'|'Pedro'|'Kajal'|'Hiujin'|'Laura'|'Elin'|'Ida'|'Suvi'|'Ola'|'Hala'|'Andres'|'Sergio'|'Remi'|'Adriano'|'Thiago'|'Ruth'|'Stephen'|'Kazuha'|'Tomoko'

    let langCode = 'ko-KR';  // ko-KR en-US(영어)) ja-JP(일본어)) cmn-CN(중국어)) sv-SE(스페인어))
    if(conversationType == 'translation') {
        langCode = 'en-US';
        voiceId = 'Joanna'; // child Ivy adult Joanna
        speed = '100';
    }    
    
    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            response = JSON.parse(xhr.responseText);
            // console.log("response: ", response);

            audioData[requestId+text] = response.body;

            console.log('successfully loaded. text= '+text);
            // console.log(response.body);
            // console.log(audioData[requestId+text]);
        }
    };
    
    var requestObj = {
        "text": text,
        "voiceId": voiceId,
        "langCode": langCode,
        "speed": speed
    }
    // console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);            
} 

function playAudioList() {
    console.log('next = '+next+', playList: '+playList.length);
    
    for(let i=0; i<playList.length;i++) {
        // console.log('audio data--> ', audioData[requestId+playList[i].text])
        console.log('playedList: ', playList);

        if(next == true && playList[i].played == false && requestId == playList[i].requestId && audioData[requestId+playList[i].text]) {
            console.log('[play] '+i+': '+requestId+', text: '+playList[i].text);
            current = i;
            playAudioLine(audioData[requestId+playList[i].text]);            
            next = false;
            break;
        }
        else if(requestId != playList[i].requestId) {
            playList[i].played = true;
        }
    }
}

async function playAudioLine(audio_body){    
    var sound = "data:audio/ogg;base64,"+audio_body;
    
    var audio = document.querySelector('audio');
    audio.src = sound;
    
    console.log('play audio');
    await playAudio(audio)
}

// audio play
var audio = document.querySelector('audio');
audio.addEventListener("ended", function() {
    console.log("finish audio, text= ", playList[current].text)
    delay(1000)

    next = true;
    playList[current].played = true;
    audioData.remove([requestId+playList[current].text]);

    playAudioList()
});

function playAudio(audio) {
    return new Promise(res=>{
        audio.play()
        audio.onended = res
    })
}

// Documents
const title = document.querySelector('#title');
const sendBtn = document.querySelector('#sendBtn');
const message = document.querySelector('#chatInput')
const chatPanel = document.querySelector('#chatPanel');

let isResponsed = new HashMap();
let indexList = new HashMap();
let retryNum = new HashMap();

// message log list
let msglist = [];
let maxMsgItems = 200;
let msgHistory = new HashMap();
let callee = "AWS";
let index=0;

let conversationType = localStorage.getItem('convType'); // set convType if exists 
if(conversationType=="") {
    conversationType = "normal";
}
console.log('conversationType: ', conversationType);

initiate();

function initiate() {
    for (i=0;i<maxMsgItems;i++) {
        msglist.push(document.getElementById('msgLog'+i));
    
        // add listener        
        (function(index) {
            msglist[index].addEventListener("click", function() {
                if(msglist.length < maxMsgItems) i = index;
                else i = index + maxMsgItems;
    
                console.log('click! index: '+index);
            })
        })(i);
    }
    calleeName.textContent = "Chatbot";  
    // calleeId.textContent = "AWS";

    if(langstate=='korean') {
        addNotifyMessage("Amazon Bedrock을 이용하여 채팅을 시작합니다.");
        addReceivedMessage(uuidv4(), "아마존 베드락을 이용하여 주셔서 감사합니다. 편안한 대화를 즐기실수 있으며, 파일을 업로드하면 요약을 할 수 있습니다.")
    }
    else {
        addNotifyMessage("Start chat with Amazon Bedrock");             
        addReceivedMessage(uuidv4(), "Welcome to Amazon Bedrock. Use the conversational chatbot and summarize documents, TXT, PDF, and CSV. ")           
    }

    getHistory(userId, 'initiate');
}

// Listeners
message.addEventListener('keyup', function(e){
    if (e.keyCode == 13) {
        onSend(e);
    }
});

// refresh button
refreshChatWindow.addEventListener('click', function(){
    console.log('go back user input menu');
    window.location.href = "index.html";
});

// depart button
depart.addEventListener('click', function(){
    console.log('depart icon');
    
    deleteItems(userId);    
});

function updateChatHistory() {
    for(i=0;i<maxMsgItems;i++) {
        msglist[i].innerHTML = `<div></div>`
    }
    
    msglist = [];
    index = 0;

    msgHistory = new HashMap();
    indexList = new HashMap();
    
    for (i=0;i<maxMsgItems;i++) {
        msglist.push(document.getElementById('msgLog'+i));
    
        // add listener        
        (function(index) {
            msglist[index].addEventListener("click", function() {
                if(msglist.length < maxMsgItems) i = index;
                else i = index + maxMsgItems;
    
                console.log('click! index: '+index);
            })
        })(i);
    } 

    getHistory(userId, 'update');    
}

sendBtn.addEventListener('click', onSend);
function onSend(e) {
    e.preventDefault();

    if(message.value != '') {
        if(index>maxMsgItems-20) {
            updateChatHistory();
        } 

        console.log("msg: ", message.value);

        let current = new Date();
        let datastr = getDate(current);
        let timestr = getTime(current);
        let requestTime = datastr+' '+timestr

        let requestId = uuidv4();
        addSentMessage(requestId, timestr, message.value);

        console.log('request to estimate the score');
        getScore(userId, requestId, message.value);
        
        if(protocol == 'WEBSOCKET') {
            sendMessage({
                "user_id": userId,
                "request_id": requestId,
                "request_time": requestTime,        
                "type": "text",
                "body": message.value,
                "convType": conversationType
            })
        }
        else {
            sendRequest(message.value, requestId, requestTime);
        }           
    }
    message.value = "";

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
}

// UUID 
function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

(function() {
    window.addEventListener("focus", function() {
        // console.log("Back to front");

        // if(msgHistory.get(callee))
        //    updateCallLogToDisplayed();
    })
})();

function getDate(current) {    
    return current.toISOString().slice(0,10);
}

function getTime(current) {
    let time_map = [current.getHours(), current.getMinutes(), current.getSeconds()].map((a)=>(a < 10 ? '0' + a : a));
    return time_map.join(':');
}

function addSentMessage(requestId, timestr, text) {
    if(!indexList.get(requestId+':send')) {
        indexList.put(requestId+':send', index);             
    }
    else {
        index = indexList.get(requestId+':send');
        console.log("reused index="+index+', id='+requestId+':send');        
    }
    console.log("index:", index);   

    var length = text.length;    
    console.log('length: ', length);
    if(length < 10) {
        msglist[index].innerHTML = 
            `<div class="chat-sender20 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;   
    }
    else if(length < 14) {
        msglist[index].innerHTML = 
            `<div class="chat-sender25 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;   
    }
    else if(length < 17) {
        msglist[index].innerHTML = 
            `<div class="chat-sender30 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }  
    else if(length < 21) {
        msglist[index].innerHTML = 
            `<div class="chat-sender35 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }
    else if(length < 26) {
        msglist[index].innerHTML = 
            `<div class="chat-sender40 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }
    else if(length < 35) {
        msglist[index].innerHTML = 
            `<div class="chat-sender50 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }
    else if(length < 80) {
        msglist[index].innerHTML = 
            `<div class="chat-sender60 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }  
    else if(length < 145) {
        msglist[index].innerHTML = 
            `<div class="chat-sender70 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }  
    else {
        msglist[index].innerHTML = 
            `<div class="chat-sender80 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }     

    index++;       
    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
}       

function addSentMessageForSummary(requestId, timestr, text) {  
    console.log("sent message: "+text);

    if(!indexList.get(requestId+':send')) {
        indexList.put(requestId+':send', index);             
    }
    else {
        index = indexList.get(requestId+':send');
        console.log("reused index="+index+', id='+requestId+':send');        
    }
    console.log("index:", index);   

    let length = text.length;
    if(length < 100) {
        msglist[index].innerHTML = 
            `<div class="chat-sender60 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;   
    }
    else {
        msglist[index].innerHTML = 
            `<div class="chat-sender80 chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;
    }   

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
    index++;
}  

function getScore(userId, requestId, text) {
    const uri = "score";
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));   
            let result = response.result;
            console.log("result: " + JSON.stringify(result));   
            let score = result.score;
            console.log("score: " + score);    
            let description = result.description;
            console.log("description: " + description);    

            addNotifyMessage('[debug] score: '+score+', description: '+description);
        }
    };

    let mbti;
    if(conversationType=='normal' || conversationType=='translation') mbti = 'ISTP';
    else mbti = conversationType;
    console.log('mbti: ', mbti);

    var requestObj = {
        "userId": userId,
        "requestId": requestId,
        "text": text,
        "mbti": mbti
    }
    console.log("request for getScore: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);   
}

function addReceivedMessage(requestId, msg) {
    // console.log("add received message: "+msg);
    sender = "Chatbot"

    if(!indexList.get(requestId+':receive')) {
        indexList.put(requestId+':receive', index);             
    }
    else {
        index = indexList.get(requestId+':receive');
        // console.log("reused index="+index+', id='+requestId+':receive');        
    }
    // console.log("index:", index);   

    msg = msg.replaceAll("\n", "<br/>");

    var length = msg.length;
    // console.log('msg: ', msg)
    // console.log("length: ", length);

    if(length < 10) {
        msglist[index].innerHTML = `<div class="chat-receiver20 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else if(length < 14) {
        msglist[index].innerHTML = `<div class="chat-receiver25 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else if(length < 17) {
        msglist[index].innerHTML = `<div class="chat-receiver30 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else if(length < 21) {
        msglist[index].innerHTML = `<div class="chat-receiver35 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else if(length < 25) {
        msglist[index].innerHTML = `<div class="chat-receiver40 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else if(length < 35) {
        msglist[index].innerHTML = `<div class="chat-receiver50 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else if(length < 80) {
        msglist[index].innerHTML = `<div class="chat-receiver60 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else if(length < 145) {
        msglist[index].innerHTML = `<div class="chat-receiver70 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }
    else {
        msglist[index].innerHTML = `<div class="chat-receiver80 chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
    }

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
    index++;
}

function addNotifyMessage(msg) {
    console.log("index:", index);   

    msglist[index].innerHTML =  
        `<div class="notification-text">${msg}</div>`;     

    index++;

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
}

refreshChatWindow.addEventListener('click', function(){
    console.log('update chat window');
    // updateChatWindow(callee);
});

attachFile.addEventListener('click', function(){
    console.log('click: attachFile');

    let input = $(document.createElement('input')); 
    input.attr("type", "file");
    input.trigger('click');    
    
    $(document).ready(function() {
        input.change(function(evt) {
            var input = this;
            var url_file = $(this).val();
            var ext = url_file.substring(url_file.lastIndexOf('.') + 1).toLowerCase();
            var filename = url_file.substring(url_file.lastIndexOf('\\') + 1).toLowerCase();

            console.log('url: ' + url_file);
            console.log('filename: ' + filename);
            console.log('ext: ' + ext);

            if(ext == 'pdf') {
                contentType = 'application/pdf'           
            }
            else if(ext == 'txt') {
                contentType = 'text/plain'
            }
            else if(ext == 'csv') {
                contentType = 'text/csv'
            }
            else if(ext == 'ppt') {
                contentType = 'application/vnd.ms-powerpoint'
            }
            else if(ext == 'pptx') {
                contentType = 'application/vnd.ms-powerpoint'
            }
            else if(ext == 'doc' || ext == 'docx') {
                contentType = 'application/msword'
            }
            else if(ext == 'xls') {
                contentType = 'application/vnd.ms-excel'
            }
            else if(ext == 'py') {
                contentType = 'application/x-python-code'
            }
            else if(ext == 'js') {
                contentType = 'application/javascript'
            }
            else if(ext == 'md') {
                contentType = 'text/markdown'
            }
            else if(ext == 'png') {
                contentType = 'image/png'
            }
            else if(ext == 'jpeg' || ext == 'jpg') {
                contentType = 'image/jpeg'
            }

            let current = new Date();
            let datastr = getDate(current);
            let timestr = getTime(current);
            let requestTime = datastr+' '+timestr
            let requestId = uuidv4();

            let commend = message.value;
            console.log('commend: ', commend)
            if((ext == 'png' || ext == 'jpeg' || ext == 'jpg') && commend!="") {
                addSentMessageForSummary(requestId, timestr, message.value+"<br>"+"uploading the selected file in order to summerize...");

                message.value = "";
            }
            else {
                addSentMessageForSummary(requestId, timestr, "uploading the selected file in order to summerize...");
            }

            const uri = "upload";
            const xhr = new XMLHttpRequest();
        
            xhr.open("POST", uri, true);
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    response = JSON.parse(xhr.responseText);
                    console.log("response: " + JSON.stringify(response));
                                        
                    // upload the file
                    const body = JSON.parse(response.body);
                    console.log('body: ', body);

                    const uploadURL = body.UploadURL;                    
                    console.log("UploadURL: ", uploadURL);

                    var xmlHttp = new XMLHttpRequest();
                    xmlHttp.open("PUT", uploadURL, true);       

                    //let formData = new FormData();
                    //formData.append("attachFile" , input.files[0]);
                    //console.log('uploading file info: ', formData.get("attachFile"));

                    const blob = new Blob([input.files[0]], { type: contentType });

                    xmlHttp.onreadystatechange = function() {
                        if (xmlHttp.readyState == XMLHttpRequest.DONE && xmlHttp.status == 200 ) {
                            console.log(xmlHttp.responseText);

                            sendMessage({
                                "user_id": userId,
                                "request_id": requestId,
                                "request_time": requestTime,
                                "type": "document",
                                "body": filename,
                                "commend": commend,
                                "convType": conversationType
                            })                                                        
                        }
                        else if(xmlHttp.readyState == XMLHttpRequest.DONE && xmlHttp.status != 200) {
                            console.log('status' + xmlHttp.status);
                            alert("Try again! The request was failed.");
                        }
                    };
        
                    xmlHttp.send(blob); 
                    // xmlHttp.send(formData); 
                    console.log(xmlHttp.responseText);
                }
            };
        
            var requestObj = {
                "type": "doc",
                "filename": filename,
                "contentType": contentType,
            }
            console.log("request from file: " + JSON.stringify(requestObj));
        
            var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});
        
            xhr.send(blob);       
        });
    });
       
    return false;
});

function sendRequest(text, requestId, requestTime) {
    const uri = "chat";
    const xhr = new XMLHttpRequest();

    isResponsed.put(requestId, false);
    retryNum.put(requestId, 12); // max 60s (5x12)

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));
            
            addReceivedMessage(response.request_id, response.msg)
        }
        else if(xhr.readyState ===4 && xhr.status === 504) {
            console.log("response: " + xhr.readyState + ', xhr.status: '+xhr.status);

            getResponse(requestId);
        }
    };

    var requestObj = {
        "user_id": userId,
        "request_id": requestId,
        "request_time": requestTime,
        "type": "text",
        "body":text
    }
    console.log("request for query: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);            
}

function sendRequestForSummary(object, requestId, requestTime) {
    const uri = "chat";
    const xhr = new XMLHttpRequest();

    isResponsed.put(requestId, false);
    retryNum.put(requestId, 60); // max 300s (5x60)

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));
            
            addReceivedMessage(response.request_id, response.msg)
        }
        else if(xhr.readyState ===4 && xhr.status === 504) {
            console.log("response: " + xhr.readyState + ', xhr.status: '+xhr.status);

            getResponse(requestId);
        }
        else {
            console.log("response: " + xhr.readyState + ', xhr.status: '+xhr.status);
        }
    };
    
    var requestObj = {
        "user_id": userId,
        "request_id": requestId,
        "request_time": requestTime,
        "type": "document",
        "body": object
    }
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);            
}

function delay(ms = 1000) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function getResponse(requestId) {
    await delay(5000);
    
    let n = retryNum.get(requestId);
    if(n == 0) {
        console.log('Failed!')
        return;
    }
    else {
        console.log('Retry!');
        retryNum.put(requestId, n-1);
        sendRequestForRetry(requestId);
    }    
}

function sendRequestForRetry(requestId) {
    const uri = "query";
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));
                        
            if(response.msg) {
                isResponsed.put(response.request_id, true);
                addReceivedMessage(response.request_id, response.msg);        
                
                console.log('completed!');
            }            
            else {
                console.log('The request is not completed yet.');

                getResponse(requestId);
            }
        }
    };
    
    var requestObj = {
        "request_id": requestId,
    }
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);            
}

let initialHistoryLength = 5;
function getHistory(userId, state) {
    const uri = "history";
    const xhr = new XMLHttpRequest();

    let allowTime = getAllowTime();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            let history = JSON.parse(response['msg']);
            // console.log("history: " + JSON.stringify(history));
                      
            let start = 0;
            if(history.length > initialHistoryLength) {
                index = 0;
                start = history.length - initialHistoryLength;
            }
            for(let i=start; i<history.length; i++) {
                if(history[i].type=='text') {                
                    // let timestr = history[i].request_time.substring(11, 19);
                    let requestId = history[i].request_id;
                    console.log("requestId: ", requestId);
                    let timestr = history[i].request_time;
                    console.log("timestr: ", timestr);
                    let body = history[i].body;
                    console.log("question: ", body);
                    let msg = history[i].msg;
                    console.log("answer: ", msg);
                    addSentMessage(requestId, timestr, body)
                    addReceivedMessage(requestId, msg);                            
                }                 
            }         
            if(history.length>=1 && state=='initiate') {
                if(langstate=='korean') {
                    addNotifyMessage("대화를 다시 시작하였습니다.");
                }
                else {
                    addNotifyMessage("Welcome back to the conversation");                               
                }                
            }

            chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
        }
    };
    
    var requestObj = {
        "userId": userId,
        "allowTime": allowTime
    }
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);            
}

function deleteItems(userId) {
    const uri = "delete";
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));

            window.location.href = "index.html";
        }
    };
    
    var requestObj = {
        "userId": userId
    }
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);            
}

function getAllowTime() {    
    let allowableDays = 2; // two day's history
    
    let current = new Date();
    let allowable = new Date(current.getTime() - 24*60*60*1000*allowableDays);  
    let allowTime = getDate(allowable)+' '+getTime(current);
    console.log('Current Time: ', getDate(current)+' '+getTime(current));
    console.log('Allow Time: ', allowTime);
    
    return allowTime;
}