const [$captureMedia, $createPc, $createOffer, $sendOffer] = document.querySelectorAll('button');

let pc;
let stream;
$captureMedia.onclick = async () => {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log(stream);
};
$createPc.onclick = async () => {
  window.pc = pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
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

function paramsToAnswerSDP(offerSdp, { iceParams, iceCandidates }) {
  const { usernameFragment, password } = iceParams;

  let sdpLines = offerSdp.split('\r\n');

  const mLine = sdpLines.find(line => line.startsWith('m='));
  const [mMain, , , mRtpmapVal] = mLine.split(' ');
  const fixedMLine = [mMain, '7', 'RTP/SAVPF', mRtpmapVal].join(' ');

  sdpLines = sdpLines.map(line => {
    if (line.startsWith('a=send')) {
      return 'a=recvonly';
    }
    if (line.startsWith('a=setup')) {
      return 'a=setup:active';
    }
    if (line.startsWith('m=')) {
      return fixedMLine;
    }
    if (line.startsWith('c=')) {
      return 'c=IN IP4 127.0.0.1';
    }
    if (line.startsWith('a=rtpmap')) {
      if (line.startsWith(`a=rtpmap:${mRtpmapVal}`)) {
        return line;
      }
        return '';

    }
    if (
      line.startsWith('a=candidate') ||
      line.startsWith('a=ice-') ||
      line.startsWith('a=msid') ||
      line.startsWith('a=extmap') ||
      line.startsWith('a=fmtp') ||
      line.startsWith('a=rtcp') ||
      line.startsWith('a=fingerprint') ||
      line.startsWith('a=ssrc')
    ) {
      return '';
    }
    return line;
  }).filter(Boolean);

  // pretend ICE-Lite server
  sdpLines.splice(4, 0,
    // TODO: enable this ends up w/ missing USE-CANDIDATE...
    // 'a=ice-lite',
    // tslint:disable-next-line:max-line-length
    'a=fingerprint:sha-512 12:DC:40:86:73:D6:F0:29:60:08:92:E4:14:52:E7:58:12:B5:A5:A5:6C:75:29:34:F9:EF:72:8B:06:C4:D8:B2:D0:A8:F9:CD:42:CC:05:B2:57:76:19:82:4E:14:90:84:68:96:64:D2:C8:76:55:CA:C5:3C:82:0E:54:14:85:60',
    'a=msid-semantic: WMS *',
  );

  sdpLines.push(
    `a=ice-ufrag:${usernameFragment}`,
    `a=ice-pwd:${password}`,
  );
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
    'a=rtcp-mux',
    'a=rtcp-rsize',
    '',
  );

  return sdpLines.join('\r\n');
}
