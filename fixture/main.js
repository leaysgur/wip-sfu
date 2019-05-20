const [
  $captureMedia,
  $createPc,
  $createOffer,
  $sendOffer
] = document.querySelectorAll("button");

let pc;
let stream;
let sender;
$captureMedia.onclick = async () => {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log(stream);
};
$createPc.onclick = async () => {
  window.pc = pc = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
  pc.oniceconnectionstatechange = () =>
    console.warn("iceConnectionState", pc.iceConnectionState);
  console.log(pc);
};
$createOffer.onclick = async () => {
  const transceiver = pc.addTransceiver(stream.getAudioTracks()[0], {
    direction: "sendonly",
    streams: [stream]
  });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log(pc.localDescription.sdp);
  window.sender = sender = transceiver.sender;
};
$sendOffer.onclick = async () => {
  const url = new URL("http://127.0.0.1:9001/publish");
  url.searchParams.append("id", Date.now());

  const iceParams = extractIceParams(pc.localDescription.sdp);
  Object.entries(iceParams).forEach(([key, val]) =>
    url.searchParams.append(key, val)
  );

  const connParams = await fetch(url.toString(), { mode: "cors" }).then(res =>
    res.json()
  );
  const answer = await paramsToAnswerSDP(connParams);
  console.log(answer.sdp);
  await pc.setRemoteDescription(answer);
  console.log(sender.transport);
};

function extractIceParams(sdp) {
  const params = {
    usernameFragment: "",
    password: ""
  };

  for (const line of sdp.split("\r\n")) {
    if (line.startsWith("a=ice-ufrag:")) {
      params.usernameFragment = line.split("a=ice-ufrag:")[1];
    }
    if (line.startsWith("a=ice-pwd:")) {
      params.password = line.split("a=ice-pwd:")[1];
    }
  }

  return params;
}

async function paramsToAnswerSDP({ iceParams, iceCandidates }) {
  const baseLines = `
v=0
o=mediasoup-client 10000 1 IN IP4 0.0.0.0
s=-
t=0 0
a=ice-lite
a=fingerprint:sha-512 87:79:86:B2:18:BE:BC:C4:4D:98:B4:B6:98:DA:ED:58:4F:7C:18:15:15:B2:FC:47:8D:75:1B:F6:58:27:27:19:D9:5A:E9:08:1E:DB:1F:BA:CE:57:3C:8E:23:6B:D3:02:01:D7:6B:6C:C2:BE:0F:81:51:3C:62:0A:8A:36:C1:FA
a=msid-semantic: WMS *
a=group:BUNDLE 0
m=audio 7 UDP/TLS/RTP/SAVPF 111
c=IN IP4 127.0.0.1
a=rtpmap:111 opus/48000/2
a=extmap:3 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=setup:active
a=mid:0
a=recvonly
a=ice-ufrag:vxusqovw9i555wid
a=ice-pwd:8int3t8pajm2yhny5b8y8m1qngjfjagb
a=candidate:udpcandidate 1 udp 1076558079 127.0.0.1 43830 typ host
a=end-of-candidates
a=ice-options:renomination
a=rtcp-mux
a=rtcp-rsize
  `
    .trim()
    .split("\n");

  const answerLines = [];
  for (let line of baseLines) {
    if (line.startsWith("a=ice-ufrag")) {
      const { usernameFragment } = iceParams;
      line = `a=ice-ufrag:${usernameFragment}`;
    }
    if (line.startsWith("a=ice-pwd")) {
      const { password } = iceParams;
      line = `a=ice-pwd:${password}`;
    }
    if (line.startsWith("a=candidate")) {
      const candidate = iceCandidates[0];
      line = `a=candidate:${candidate.foundation} ${candidate.component} ${
        candidate.protocol
      } ${candidate.priority} ${candidate.address} ${candidate.port} typ ${
        candidate.type
      }`;
    }
    if (line.startsWith("c=IN")) {
      const candidate = iceCandidates[0];
      line = `c=IN IP4 ${candidate.address}`;
    }
    if (line.startsWith("o=")) {
      line = "o=wip-sfu 10000 1 IN IP4 0.0.0.0";
    }

    answerLines.push(line);
  }

  return new RTCSessionDescription({
    type: "answer",
    sdp: answerLines.join("\r\n") + "\r\n"
  });
}
