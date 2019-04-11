const [$captureMedia, $createPc, $createOffer, $sendOffer] = document.querySelectorAll('button');

let pc;
let stream;
$captureMedia.onclick = async () => {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log(stream);
};
$createPc.onclick = async () => {
  window.pc = pc = new RTCPeerConnection();
  pc.oniceconnectionstatechange = () => console.warn('iceConnectionState', pc.iceConnectionState);
  pc.onconnectionstatechange = () => console.warn('connectionState', pc.connectionState);
  console.log(pc);
};
$createOffer.onclick = async () => {
  pc.addTransceiver(stream.getAudioTracks()[0], { direction: 'sendonly', streams: [stream] });
  const offer = await pc.createOffer();
  console.log(offer.sdp);
  await pc.setLocalDescription(offer);
};
$sendOffer.onclick = async () => {
  const url = new URL('http://127.0.0.1:9001/publish');
  url.searchParams.append('id', Date.now());

  const iceParams = extractIceParams(pc.localDescription.sdp);
  Object.entries(iceParams).forEach(([key, val]) => url.searchParams.append(key, val));

  const answer = await fetch(url.toString(), { mode: 'cors' }).then(res => res.text());
  console.log(answer);
  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer }));
};

function extractIceParams(sdp) {
  const params = {
    usernameFragment: '',
    password: '',
  };

  for (const line of sdp.split('\r\n')) {
    if (line.startsWith('a=ice-ufrag:')) {
      params.usernameFragment = line.split('a=ice-ufrag:')[1];
    }
    if (line.startsWith('a=ice-pwd:')) {
      params.password = line.split('a=ice-pwd:')[1];
    }
  }

  return params;
}
