// The WebRTC connection between this browser and the other one
let peerConnection;
// This browser's camera stream
let localStream;
// The other browser's video, filled in as its tracks arrive
let remoteStream;


// Pick the user from the address (?user=1 or ?user=2); `users` comes from config.js, default is user 1
let user = users[new URLSearchParams(location.search).get("user")] || users[1]

// The Agora user ID this browser logs in as
let uid = user.uid
// The Agora temp token that matches this user ID
let token = user.token
// The Agora RTM client, used only to send signaling messages between the browsers
let client;

// STUN servers help each browser find its public address so the two can reach each other
let servers = {
    // List of ICE servers WebRTC may use to discover connection routes
    iceServers: [
        {
            // Google's free public STUN servers
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


// Runs once when the page loads: start the camera, log in to Agora and join the room
let init = async () => {
    // Ask for camera access (no microphone)
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    // Show our own camera in the left video box
    document.getElementById('user-1').srcObject = localStream

    // Create the Agora messaging client for our App ID
    client = await AgoraRTM.createInstance(APP_ID)
    // Log in to Agora with our user ID and token
    await client.login({ uid, token })

    // Get the shared room both browsers use
    const channel = client.createChannel('test2')
    // Enter the room
    channel.join()

    // When someone else enters the room, start a call with them
    channel.on('MemberJoined', handlePeerJoined)
    // When the other browser sends us a message (offer, answer or candidate), handle it
    client.on('MessageFromPeer', handleMessageFromPeer)
}

// Called when another browser joins the room
let handlePeerJoined = async (MemberId) => {
    // Log who joined
    console.log('A new peer has joined this room:', MemberId)
    // We were here first, so we send them an offer to start the call
    createOffer(MemberId)
}

// Called for every message the other browser sends us through Agora
let handleMessageFromPeer = async (message, MemberId) => {
    // Messages are sent as JSON text; turn them back into an object
    message = JSON.parse(message.text)
    // Log the message type (offer, answer or candidate)
    console.log('Message:', message.type)

    // The other browser wants to start a call with us
    if (message.type === 'offer') {
        // Make sure our camera is running before we answer
        if (!localStream) {
            // Ask for camera access
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            // Show our own camera in the left video box
            document.getElementById('user-1').srcObject = localStream
        }

        // Put the received offer in the offer text box
        document.getElementById('offer-sdp').value = JSON.stringify(message.offer)
        // Reply with an answer
        createAnswer(MemberId)
    }

    // The other browser accepted our offer
    if (message.type === 'answer') {
        // Put the received answer in the answer text box
        document.getElementById('answer-sdp').value = JSON.stringify(message.answer)
        // Apply the answer to finish the connection setup
        addAnswer()
    }

    // The other browser found a possible network route to it
    if (message.type === 'candidate') {
        // Only add it if our connection object exists yet
        if (peerConnection) {
            // Give the route to WebRTC so it can try connecting through it
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}

// Sets up the WebRTC connection object; sdpType is the text box id to show our description in
let createPeerConnection = async (sdpType, MemberId) => {
    // Create the connection using our STUN servers
    peerConnection = new RTCPeerConnection(servers)

    // Create an empty stream to hold the other browser's video
    remoteStream = new MediaStream()
    // Show that stream in the right video box
    document.getElementById('user-2').srcObject = remoteStream

    // Go through each track of our camera stream (just video here)
    localStream.getTracks().forEach((track) => {
        // Send that track to the other browser over the connection
        peerConnection.addTrack(track, localStream)
    })

    // Runs when video from the other browser arrives
    peerConnection.ontrack = async (event) => {
        // Go through each incoming track
        event.streams[0].getTracks().forEach((track) => {
            // Add it to the stream shown in the right video box
            remoteStream.addTrack(track)
        })
    }

    // Runs each time WebRTC finds a possible network route for us
    peerConnection.onicecandidate = async (event) => {
        // A null candidate means the search is finished, so skip it
        if (event.candidate) {
            // Refresh the text box with our latest description
            document.getElementById(sdpType).value = JSON.stringify(peerConnection.localDescription)
            // Send the route to the other browser through Agora
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
        }
    }
}

// Starts a call: builds an offer and sends it to the other browser
let createOffer = async (MemberId) => {

    // Set up the connection; our description goes in the offer text box
    createPeerConnection('offer-sdp', MemberId)

    // Build the offer describing our video and connection settings
    let offer = await peerConnection.createOffer()
    // Save the offer as our side of the connection
    await peerConnection.setLocalDescription(offer)

    // Show the offer in the offer text box
    document.getElementById('offer-sdp').value = JSON.stringify(offer)
    // Send the offer to the other browser through Agora
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId)
}

// Answers a received offer and sends the answer back
let createAnswer = async (MemberId) => {
    // Set up the connection; our description goes in the answer text box
    createPeerConnection('answer-sdp', MemberId)

    // Read the received offer from the offer text box
    let offer = document.getElementById('offer-sdp').value
    // Stop if there is no offer yet
    if (!offer) return alert('Retrieve offer from peer first...')

    // Turn the offer text back into an object
    offer = JSON.parse(offer)
    // Save the offer as the other browser's side of the connection
    await peerConnection.setRemoteDescription(offer)

    // Build our answer to that offer
    let answer = await peerConnection.createAnswer()
    // Save the answer as our side of the connection
    await peerConnection.setLocalDescription(answer)

    // Show the answer in the answer text box
    document.getElementById('answer-sdp').value = JSON.stringify(answer)
    // Send the answer back to the other browser through Agora
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId)
}

// Applies the other browser's answer to finish connecting
let addAnswer = async () => {
    // Read the received answer from the answer text box
    let answer = document.getElementById('answer-sdp').value
    // Stop if there is no answer yet
    if (!answer) return alert('Retrieve answer from peer first...')

    // Turn the answer text back into an object
    answer = JSON.parse(answer)

    // Only apply it if we haven't already
    if (!peerConnection.currentRemoteDescription) {
        // Save the answer as the other browser's side; the video can now flow
        peerConnection.setRemoteDescription(answer)
    }

}

// Start everything when the page loads
init()

// Old manual buttons, turned off because the call now connects by itself
// document.getElementById('create-offer').addEventListener('click', createOffer)
// document.getElementById('create-answer').addEventListener('click', createAnswer)
// document.getElementById('add-answer').addEventListener('click', addAnswer)
