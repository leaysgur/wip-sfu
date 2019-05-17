const [$captureMedia, $createPc, $createOffer, $sendOffer] = document.querySelectorAll('button');

let pc;
let stream;
let sender;
$captureMedia.onclick = async () => {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log(stream);
};
$createPc.onclick = async () => {
  window.pc = pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
  pc.oniceconnectionstatechange = () => console.warn('iceConnectionState', pc.iceConnectionState);
  console.log(pc);
};
$createOffer.onclick = async () => {
  const transceiver = pc.addTransceiver(stream.getAudioTracks()[0], { direction: 'sendonly' });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitGatheringCandidates(pc);
  console.log(pc.localDescription.sdp);
  window.sender = sender = transceiver.sender;
};
$sendOffer.onclick = async () => {
  const url = new URL('http://127.0.0.1:9001/publish');
  url.searchParams.append('id', Date.now());

  const iceParams = extractIceParams(pc.localDescription.sdp);
  Object.entries(iceParams).forEach(([key, val]) => url.searchParams.append(key, val));

  const connParams = await fetch(url.toString(), { mode: 'cors' }).then(res => res.json());
  const answer = await paramsToAnswerSDP(pc.localDescription, connParams);
  console.log(answer.sdp);
  await pc.setRemoteDescription(answer);
  console.log(sender.transport);
};

async function waitGatheringCandidates(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') {
      return res();
    }

    pc.onicecandidate = ev => {
      if (ev.candidate === null) {
        res();
      }
    };
  });
}

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

async function paramsToAnswerSDP(offerSdp, { iceParams, iceCandidates }) {
  // use fake pc to generate answer SDP
  const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
  await pc.setRemoteDescription(offerSdp);
  const answer = await pc.createAnswer();
  pc.close();

  const { usernameFragment, password } = iceParams;

  let sdpLines = answer.sdp.split('\r\n');

  // add
  sdpLines.splice(4, 0, 'a=ice-lite');

  // mod
  sdpLines = sdpLines.map(line => {
    if (line.startsWith('a=ice-ufrag')) {
      return `a=ice-ufrag:${usernameFragment}`;
    }
    if (line.startsWith('a=ice-pwd')) {
      return `a=ice-pwd:${password}`;
    }
    if (line.startsWith('a=ice-options')) {
      return '';
    }
    return line;
  }).filter(Boolean);

  // add
  for (const candidate of iceCandidates) {
    sdpLines.push(
      `a=candidate:${candidate.foundation} ${candidate.component} ${
        candidate.protocol
      } ${candidate.priority} ${candidate.address} ${candidate.port} typ ${
        candidate.type
      }`,
    );
  }
  sdpLines.push(
    'a=end-of-candidates',
    'a=rtcp-rsize',
    '',
  );

  answer.sdp = sdpLines.join('\r\n');
  return answer;
}
