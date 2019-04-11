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

  const connParams = await fetch(url.toString(), { mode: 'cors' }).then(res => res.json());
  const answer = paramsToAnswerSDP(pc.localDescription.sdp, connParams);
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

function paramsToAnswerSDP(offerSdp, { iceParams, iceCandidate }) {
  const { usernameFragment, password } = iceParams;
  const candidate = iceCandidate;

  const sdpLines = offerSdp.split('\r\n');
  const mLine = sdpLines.find(line => line.startsWith('m='));
  const rtpMapLines = sdpLines.filter(line => line.startsWith('a=rtpmap:'));

  return [
    'v=0',
    'o=wip-webrtc 10000 1 IN IP4 0.0.0.0',
    's=-',
    't=0 0',
    'a=ice-lite',
    // tslint:disable-next-line:max-line-length
    'a=fingerprint:sha-512 10:13:09:9F:88:F4:A6:D0:18:F3:AA:F5:01:9A:E6:8A:29:FF:9E:E1:40:56:F3:97:C6:46:6A:17:FA:06:83:65:E6:85:FE:A6:30:20:48:10:EA:73:74:1A:9A:D3:66:63:01:82:F7:FA:00:EA:77:27:2B:1B:9B:C6:30:25:E5:06',
    'a=msid-semantic: WMS *',
    'a=group:BUNDLE 0',
    mLine,
    'c=IN IP4 127.0.0.1',
    ...rtpMapLines,
    'a=setup:passive',
    'a=mid:0',
    'a=recvonly',
    `a=ice-ufrag:${usernameFragment}`,
    `a=ice-pwd:${password}`,
    `a=candidate:${candidate.foundation} ${candidate.component} ${
      candidate.protocol
    } ${candidate.priority} ${candidate.address} ${candidate.port} typ ${
      candidate.type
    }`,
    'a=end-of-candidates',
    'a=ice-options:renomination',
    'a=rtcp-mux',
    'a=rtcp-rsize',
    '',
  ].join('\r\n');
}
