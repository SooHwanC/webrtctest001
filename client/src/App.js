import React, { useRef, useEffect } from 'react';
import io from 'socket.io-client';

function App() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socket = useRef();
  const peerConnection = useRef();

  useEffect(() => {
    // 프론트엔드: Websocket 연결 설정 변경
    socket.current = io('wss://codebridge.site', {
      secure: true,
      rejectUnauthorized: false // 개발 환경에서 필요한 경우
    });


    // Offer를 받는 부분
    socket.current.on('offer', async (offer) => {
      if (!peerConnection.current || peerConnection.current.signalingState === 'closed') {
        peerConnection.current = createPeerConnection();
      }

      if (peerConnection.current.signalingState === 'stable') {
        try {
          await peerConnection.current.setRemoteDescription(offer);
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.current.emit('answer', answer);
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      } else {
        console.warn('Received an offer in an unexpected state:', peerConnection.current.signalingState);
      }
    });


    // Answer를 받는 부분
    socket.current.on('answer', async (answer) => {
      if (!peerConnection.current || peerConnection.current.signalingState === 'closed') {
        console.error('PeerConnection is not initialized or closed when trying to handle answer');
        return;
      }

      if (peerConnection.current.signalingState === 'have-local-offer') {
        try {
          await peerConnection.current.setRemoteDescription(answer);
        } catch (error) {
          console.error('Error setting remote description:', error);
        }
      } else {
        console.warn('Received an answer in an unexpected state:', peerConnection.current.signalingState);
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
