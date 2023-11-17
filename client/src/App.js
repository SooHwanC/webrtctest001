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
      rejectUnauthorized: false
    });

    // Offer 처리 부분
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
        // 잘못된 상태에서 오퍼 수신 시 연결 초기화
        console.warn('Offer received in unexpected state:', peerConnection.current.signalingState);
        resetConnection();
        try {
          await peerConnection.current.setRemoteDescription(offer);
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.current.emit('answer', answer);
        } catch (error) {
          console.error('Error after resetting connection:', error);
        }
      }
    });

    // Answer 처리 부분
    socket.current.on('answer', async (answer) => {
      if (peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
        try {
          await peerConnection.current.setRemoteDescription(answer);
        } catch (error) {
          console.error('Error setting remote answer:', error);
        }
      } else {
        console.warn('Answer received in unexpected state:', peerConnection.current.signalingState);
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
        console.warn('Cannot add ICE candidate:', peerConnection.current ? peerConnection.current.signalingState : 'No peerConnection');
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

  const resetConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    peerConnection.current = createPeerConnection();
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      localVideoRef.current.srcObject = stream;
      peerConnection.current = createPeerConnection();

      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      if (peerConnection.current.signalingState === 'stable') {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.current.emit('offer', offer);
      } else {
        console.error('Not in a stable state to create offer:', peerConnection.current.signalingState);
      }

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
