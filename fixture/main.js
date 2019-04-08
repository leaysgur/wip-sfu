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
  pc.addTrack(stream.getTracks()[0], stream);
  const offer = await pc.createOffer();
  console.log(offer.sdp);
  await pc.setLocalDescription(offer);
};
$sendOffer.onclick = async () => {
  const answer = await fetch('http://127.0.0.1:9001/offer', { mode: 'cors' }).then(res => res.text());
  console.log(answer);
  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer }));
};
