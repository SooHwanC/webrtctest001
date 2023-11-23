import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

function App() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socket = useRef();
  const peerConnection = useRef();
  const [streamUpdated, setStreamUpdated] = useState(false);

  useEffect(() => {
    if (socket.current) {
      // 이미 소켓 연결이 설정된 경우 추가 설정을 방지합니다.
      console.log('소켓 이미 설정됨');
      return;
    }

    // socket.current = io('http://localhost:5001');
    socket.current = io('https://43.200.137.185:5001');
    setupSocketListeners();
  }, []);

  const setupSocketListeners = () => {
    socket.current.on('offer', handleOffer);
    socket.current.on('answer', handleAnswer);
    socket.current.on('candidate', handleCandidate);
  };

  const handleOffer = async (offer) => {
    console.log('오퍼 처리 시작', offer);

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
        console.error('오퍼 처리 중 오류:', error);
      }
    } else {
      console.warn('오퍼 처리: 예상치 못한 상태', peerConnection.current.signalingState);
    }
  };

  const handleAnswer = async (answer) => {
    console.log('앤서 처리 시작', answer);

    if (!peerConnection.current || peerConnection.current.signalingState === 'closed') {
      console.error('앤서 처리 시 피어 연결이 초기화되지 않았거나 닫혀 있음');
      return;
    }

    if (peerConnection.current.signalingState === 'have-local-offer') {
      try {
        await peerConnection.current.setRemoteDescription(answer);
      } catch (error) {
        console.error('원격 설명 설정 중 오류:', error);
      }
    } else {
      console.warn('앤서 처리: 예상치 못한 상태', peerConnection.current.signalingState);
    }
  };

  const handleCandidate = async (candidate) => {
    console.log('ICE 후보 처리 시작', candidate);

    if (peerConnection.current && peerConnection.current.remoteDescription && peerConnection.current.remoteDescription.type) {
      try {
        await peerConnection.current.addIceCandidate(candidate);
      } catch (error) {
        console.error('ICE 후보 추가 중 오류:', error);
      }
    } else {
      console.warn('ICE 후보 처리: 원격 설명이 설정되지 않았거나 피어 연결이 닫힘');
    }
  };

  const createPeerConnection = () => {
    console.log('피어 커넥션 생성');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      console.log('ICE 후보 생성:', event.candidate);
      if (event.candidate) {
        socket.current.emit('candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log('트랙 이벤트:', event.streams[0]);
      if (event.streams[0] && event.streams[0].active) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setStreamUpdated(prev => !prev); // 상태 업데이트를 통한 강제 렌더링
      } else {
        console.error('활성화되지 않았거나 정의되지 않은 스트림 수신');
      }
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
      console.error('화면 공유 중 오류:', error);
    }
  };

  return (
    <div>
      <button onClick={startScreenShare}>내 화면 공유하기</button>
      <div className='main_box'>
        <div>
          <h1>내화면</h1>
          <video ref={localVideoRef} autoPlay playsInline muted></video>
        </div>
        <div>
          <h1>공유받은 화면</h1>
          <video ref={remoteVideoRef} autoPlay playsInline></video>
        </div>
      </div>
    </div>
  );
}

export default App;
