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

    // 연결 재설정 로직
    const resetConnection = () => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      peerConnection.current = createPeerConnection();
    };

    // Offer 처리 부분
    socket.current.on('offer', async (offer) => {
      if (!peerConnection.current || peerConnection.current.signalingState === 'closed') {
        peerConnection.current = createPeerConnection();
      }

      if (peerConnection.current.signalingState !== 'stable') {
        console.warn('연결 상태가 offer를 처리하기에 적합하지 않습니다. 연결을 재설정합니다.');
        resetConnection();
        return;
      }

      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.current.emit('answer', answer);
      } catch (error) {
        console.error('Offer 처리 중 오류 발생:', error);
      }
    });

    // Answer 처리 부분
    socket.current.on('answer', async (answer) => {
      if (peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Answer 설정 중 오류 발생:', error);
          resetConnection();
        }
      } else {
        console.warn('예상치 못한 상태에서 Answer를 받았습니다:', peerConnection.current.signalingState);
      }
    });

    // ICE Candidate 처리 부분
    socket.current.on('candidate', async (candidate) => {
      if (peerConnection.current && peerConnection.current.remoteDescription && peerConnection.current.remoteDescription.type) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('ICE candidate 추가 중 오류 발생:', error);
        }
      } else {
        console.warn('ICE candidate를 추가할 수 없습니다:', peerConnection.current ? peerConnection.current.signalingState : 'peerConnection 없음');
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

      if (peerConnection.current.signalingState === 'stable') {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.current.emit('offer', offer);
      } else {
        console.error('Offer를 생성하기 적합한 상태가 아닙니다:', peerConnection.current.signalingState);
      }

    } catch (error) {
      console.error('화면 공유 중 오류 발생:', error);
    }
  };

  return (
    <div>
      <button onClick={startScreenShare}>내 화면 공유하기</button>
      <video ref={localVideoRef} autoPlay playsInline muted></video>
      <video ref={remoteVideoRef} autoPlay playsInline></video>
    </div>
  );
}

export default App;
