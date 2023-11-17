import React, { useRef, useEffect } from 'react';
import io from 'socket.io-client';

function App() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socket = useRef();
  const peerConnection = useRef();

  useEffect(() => {
    socket.current = io('https://43.200.137.185:5001', {
      secure: true,
      rejectUnauthorized: false // 개발 환경에서 필요한 경우
    });


    // Offer를 받는 부분
    socket.current.on('offer', async (offer) => {
      if (!peerConnection.current || peerConnection.current.signalingState === 'closed') {
        peerConnection.current = createPeerConnection();
      }

      // 새로운 오퍼를 받으면 기존 연결을 닫고 새 연결을 시작합니다
      if (peerConnection.current.signalingState === 'have-local-offer') {
        peerConnection.current.close(); // 기존 연결을 닫습니다
        peerConnection.current = createPeerConnection(); // 새 연결을 시작합니다
      }

      try {
        await peerConnection.current.setRemoteDescription(offer);
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.current.emit('answer', answer);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    // Answer를 받는 부분
    socket.current.on('answer', async (answer) => {
      if (peerConnection.current && peerConnection.current.signalingState !== 'closed') {
        try {
          await peerConnection.current.setRemoteDescription(answer);
        } catch (error) {
          console.error('Error setting remote description:', error);
        }
      } else {
        console.warn('Received an answer in an unexpected state:', peerConnection.current ? peerConnection.current.signalingState : 'No peerConnection');
      }
    });


    // ICE Candidate 처리 부분
    socket.current.on('candidate', async (candidate) => {
      if (peerConnection.current && peerConnection.current.remoteDescription && peerConnection.current.remoteDescription.type) {
        try {
          await peerConnection.current.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      } else {
        console.warn('Remote description is not set or PeerConnection is closed. Cannot add ICE candidate');
      }
    });



  }, []);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit('candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    return pc;
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      localVideoRef.current.srcObject = stream;
      peerConnection.current = createPeerConnection();

      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.current.emit('offer', offer);

    } catch (error) {
      console.error('Error sharing the screen:', error);
    }
  };

  return (
    <div>
      <button onClick={startScreenShare}>Share My Screen</button>
      <video ref={localVideoRef} autoPlay playsInline muted></video>
      <video ref={remoteVideoRef} autoPlay playsInline></video>
    </div>
  );
}

export default App;
