function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}


// Chat UI
const myForm = document.querySelector('#my-form');
const userInput = document.querySelector('#userId');
const convtypeInput = document.querySelector('#convtype');

// Common
let userId = localStorage.getItem('userId'); // set userID if exists 
if(userId=="") {
    userId = uuidv4();
}
else {
    userInput.value = userId
}
console.log('userId: ', userId);

myForm.addEventListener('submit', onSubmit);

let conversationType = localStorage.getItem('convType'); // set conversationType if exists 
if(conversationType != '') {
    convtypeInput.value = conversationType;
}
else {
    convtypeInput.value = "normal"  // general conversation
}

console.log(userInput.value);
console.log(convtypeInput.value);

// provisioning
getProvisioningInfo(userId);
getVoiceProvisioningInfo(userId);

function onSubmit(e) {
    e.preventDefault();
    console.log(userInput.value);
    console.log(convtypeInput.value);

    localStorage.setItem('userId',userInput.value);
    console.log('Save Profile> userId:', userInput.value)    

    localStorage.setItem('convType',convtypeInput.value);
    console.log('Save Profile> convtype:', convtypeInput.value)

    window.location.href = "chat.html";
}

function getProvisioningInfo(userId) {
    const uri = "provisioning";
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            let provisioning_info = JSON.parse(response['info']);
            console.log("provisioning info: " + JSON.stringify(provisioning_info));
                        
            let wss_url = provisioning_info.wss_url;
            console.log("wss_url: ", wss_url);

            localStorage.setItem('wss_url',wss_url);
        }
    };

    var requestObj = {
        "userId": userId
    }
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);   
}

function getVoiceProvisioningInfo(userId) {
    const uri = "voice_provisioning";
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            let voice_provisioning_info = JSON.parse(response['info']);
            console.log("voice provisioning info: " + JSON.stringify(voice_provisioning_info));
                        
            let voice_wss_url = voice_provisioning_info.wss_url;
            console.log("voice_wss_url: ", voice_wss_url);

            localStorage.setItem('voice_wss_url',voice_wss_url);
        }
    };

    var requestObj = {
        "userId": userId
    }
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);   
}
