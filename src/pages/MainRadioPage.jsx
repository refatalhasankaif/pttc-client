import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useAudio } from '../hooks/useAudio';
import api from '../utils/api';
import { Mic2, LogOut, Users, MessageCircle, Radio } from 'lucide-react';

function AudioWaves() {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="wave-bar bg-military-accent"
          style={{
            width: '3px',
            height: '100%',
            animation: `wave${i % 3 === 0 ? '3' : i % 2 === 0 ? '2' : '1'} 0.6s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function MainRadioPage() {
  useAuth();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { startRecording, stopRecording: stopAudioRecording } = useAudio(socket);
  const [profile, setProfile] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [systemMessages, setSystemMessages] = useState([]);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [isTalking, setIsTalking] = useState(false);
  const [pttDenied, setPttDenied] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const keysPressed = useRef({});
  const pttButtonPressed = useRef(false);

  const addSystemMessage = useCallback((text, type = 'info') => {
    const id = Date.now();
    setSystemMessages(prev => [...prev, { id, text, type, timestamp: new Date() }]);
    setTimeout(() => {
      setSystemMessages(prev => prev.filter(msg => msg.id !== id));
    }, 6000);
  }, []);

  const handleLogout = async () => {
    try {
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const startTalking = useCallback(() => {
    if (!isTalking && socket && connected && permissionsGranted) {
      setIsTalking(true);
      socket.emit('request-talk');
      startRecording();
    }
  }, [isTalking, socket, connected, permissionsGranted, startRecording]);

  const stopTalking = useCallback(() => {
    if (isTalking && socket && connected) {
      setIsTalking(false);
      socket.emit('release-talk');
      stopAudioRecording();
    }
  }, [isTalking, socket, connected, stopAudioRecording]);

  const handlePTTMouseDown = () => {
    pttButtonPressed.current = true;
    startTalking();
  };

  const handlePTTMouseUp = () => {
    pttButtonPressed.current = false;
    stopTalking();
  };

  const handlePTTTouchStart = (e) => {
    e.preventDefault();
    pttButtonPressed.current = true;
    startTalking();
  };

  const handlePTTTouchEnd = (e) => {
    e.preventDefault();
    pttButtonPressed.current = false;
    stopTalking();
  };

  // Request microphone and speaker permissions
  const requestPermissions = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // Stop the stream immediately as we just need permission
      stream.getTracks().forEach(track => track.stop());

      setPermissionsGranted(true);
      addSystemMessage('AUDIO PERMISSIONS GRANTED', 'info');
    } catch (error) {
      console.error('Permission error:', error);
      setPermissionError(error.name === 'NotAllowedError'
        ? 'MICROPHONE ACCESS DENIED'
        : 'MICROPHONE ACCESS ERROR');
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/profile/me');
        setProfile(response.data);
      } catch (error) {
        console.error('Fetch profile error:', error);
        navigate('/profile-setup');
      }
    };
    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    if (!socket) return;

    socket.on('online:list', (users) => {
      setOnlineUsers(users);
    });

    socket.on('system:join', (data) => {
      addSystemMessage(`${data.callsign} ENTERED`, 'info');
    });

    socket.on('system:talking', (data) => {
      addSystemMessage(`${data.callsign} TRANSMITTING`, 'talking');
      setSpeakingUsers(prev => new Set([...prev, data.callsign]));
    });

    socket.on('system:over', (data) => {
      addSystemMessage(`${data.callsign} OUT`, 'info');
      setSpeakingUsers(prev => {
        const next = new Set(prev);
        next.delete(data.callsign);
        return next;
      });
    });

    socket.on('system:out', (data) => {
      addSystemMessage(`${data.callsign} DISCONNECTED`, 'info');
      setSpeakingUsers(prev => {
        const next = new Set(prev);
        next.delete(data.callsign);
        return next;
      });
    });

    socket.on('ptt-denied', (data) => {
      setPttDenied(data.reason);
      setTimeout(() => setPttDenied(null), 2000);
    });

    socket.on('ptt-already', () => {
      setPttDenied('ALREADY TRANSMITTING');
      setTimeout(() => setPttDenied(null), 2000);
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data.error);
      addSystemMessage(`Error: ${data.error}`, 'error');
    });

    return () => {
      socket.off('online:list');
      socket.off('system:join');
      socket.off('system:talking');
      socket.off('system:over');
      socket.off('system:out');
      socket.off('ptt-denied');
      socket.off('ptt-already');
      socket.off('error');
    };
  }, [socket, addSystemMessage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift' && !keysPressed.current.shift) {
        keysPressed.current.shift = true;
        startTalking();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        keysPressed.current.shift = false;
        stopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startTalking, stopTalking]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen bg-linear-to-br from-military-900 to-military-800">
        <div className="text-military-accent font-mono uppercase tracking-widest">
          ▰▰▰ INITIALIZING ▰▰▰
        </div>
      </div>
    );
  }

  // Permission request modal
  if (!permissionsGranted && !permissionError) {
    return (
      <div className="h-screen bg-linear-to-br from-military-900 to-military-800 flex items-center justify-center p-4">
        <div className="bg-military-800 border-4 border-military-accent p-8 max-w-md w-full text-center space-y-6"
          style={{ boxShadow: '0 0 40px rgba(46, 204, 113, 0.4)' }}>
          <div className="flex justify-center mb-4">
            <Mic2 className="w-20 h-20 text-military-accent" />
          </div>
          <h2 className="text-military-accent text-2xl font-black uppercase tracking-wider">
            AUDIO ACCESS REQUIRED
          </h2>
          <p className="text-military-400 font-mono text-sm uppercase tracking-widest">
            THIS SYSTEM REQUIRES MICROPHONE ACCESS FOR VOICE TRANSMISSION
          </p>
          <button
            onClick={requestPermissions}
            className="w-full bg-military-accent hover:bg-green-500 text-military-900 font-black uppercase tracking-wider py-4 px-6 transition-all duration-200"
            style={{ boxShadow: '0 0 20px rgba(46, 204, 113, 0.3)' }}
          >
            ▰ GRANT ACCESS ▰
          </button>
          <p className="text-military-500 text-xs font-mono">
            Your audio will only be transmitted when you press the PTT button
          </p>
        </div>
      </div>
    );
  }

  // Permission error screen
  if (permissionError) {
    return (
      <div className="h-screen bg-linear-to-br from-military-900 to-military-800 flex items-center justify-center p-4">
        <div className="bg-military-800 border-4 border-military-danger p-8 max-w-md w-full text-center space-y-6"
          style={{ boxShadow: '0 0 40px rgba(231, 76, 60, 0.4)' }}>
          <h2 className="text-military-danger text-2xl font-black uppercase tracking-wider">
            ⚠ ACCESS DENIED ⚠
          </h2>
          <p className="text-military-400 font-mono text-sm uppercase tracking-widest">
            {permissionError}
          </p>
          <p className="text-military-500 text-xs font-mono">
            Please enable microphone access in your browser settings and reload the page
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-military-accent hover:bg-green-500 text-military-900 font-black uppercase tracking-wider py-4 px-6 transition-all duration-200"
          >
            ▰ RELOAD PAGE ▰
          </button>
          <button
            onClick={handleLogout}
            className="w-full bg-military-danger hover:bg-red-600 text-white font-black uppercase tracking-wider py-3 px-6 transition-all duration-200"
          >
            EXIT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-linear-to-br from-military-900 via-military-800 to-military-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-military-900 border-b-2 lg:border-b-4 border-military-accent px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 flex items-center justify-between"
        style={{ boxShadow: '0 4px 15px rgba(46, 204, 113, 0.2)' }}>
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${connected ? 'bg-military-accent' : 'bg-military-danger'} animate-pulse`} />
          <h1 className="text-sm sm:text-lg lg:text-2xl font-black text-military-accent uppercase tracking-wider flex items-center gap-1 sm:gap-2">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
            <span className="hidden sm:inline">TACTICAL NETWORK</span>
            <span className="sm:hidden">NETWORK</span>
          </h1>
          <span className="text-military-accent text-xs sm:text-sm font-mono">● LIVE</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="hidden sm:flex items-center gap-2 lg:gap-3 bg-military-800 border border-military-accent lg:border-2 px-2 py-1 sm:px-3 sm:py-2 lg:px-4"
            style={{ boxShadow: '0 0 10px rgba(46, 204, 113, 0.3)' }}>
            <img
              src={`/avatars/${profile.avatarId}.png`}
              alt="Your avatar"
              className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-full border border-military-accent lg:border-2 bg-military-700"
              onError={(e) => {
                e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%232d3436' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='40' fill='%232ecc71' font-weight='bold'%3E${profile.avatarId}%3C/text%3E%3C/svg%3E`;
              }}
            />
            <div>
              <p className="text-military-accent font-bold text-xs sm:text-sm uppercase tracking-wider">{profile.callsign}</p>
              <p className="text-military-400 text-xs uppercase hidden lg:block">{profile.realName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 bg-military-danger hover:bg-red-600 text-white px-2 py-1 sm:px-3 sm:py-2 lg:px-4 transition duration-200 uppercase font-bold text-xs sm:text-sm"
          >
            <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">EXIT</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6 overflow-hidden">
        {/* Left Panel: Online Users & Activity */}
        <div className="w-full lg:w-96 flex flex-col gap-3 sm:gap-4 lg:gap-6 lg:max-h-full">
          {/* Online Users */}
          <div className="bg-military-800 border border-military-accent lg:border-2 p-3 sm:p-4 flex flex-col"
            style={{ boxShadow: '0 0 20px rgba(46, 204, 113, 0.1)' }}>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-military-accent" />
              <h2 className="text-military-accent font-black uppercase tracking-widest text-xs sm:text-sm">ONLINE [{onlineUsers.length}]</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-32 sm:max-h-48 lg:max-h-64">
              {onlineUsers.length === 0 ? (
                <p className="text-military-400 font-mono text-xs sm:text-sm">-- AWAITING CONNECTIONS --</p>
              ) : (
                onlineUsers.map((u) => (
                  <div
                    key={u.uid}
                    className={`border-l-2 lg:border-l-4 p-2 sm:p-3 transition-all ${speakingUsers.has(u.callsign)
                      ? 'bg-military-700 border-military-accent shadow-lg'
                      : 'bg-military-700 border-military-600'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <img
                          src={`/avatars/${u.avatarId}.png`}
                          alt={u.callsign}
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full ${speakingUsers.has(u.callsign) ? 'border-2 border-military-accent' : ''}`}
                          onError={(e) => {
                            e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%232d3436' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='40' fill='%232ecc71' font-weight='bold'%3E${u.avatarId}%3C/text%3E%3C/svg%3E`;
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-military-accent font-black text-xs sm:text-sm uppercase tracking-wide truncate">{u.callsign}</p>
                          <p className="text-military-400 text-xs truncate">{u.realName}</p>
                        </div>
                      </div>
                      {speakingUsers.has(u.callsign) && (
                        <div className="w-8 h-4 sm:w-12 sm:h-6 ml-2">
                          <AudioWaves />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-military-800 border border-military-accent lg:border-2 p-3 sm:p-4 flex flex-col flex-1 min-h-37.5 lg:min-h-0"
            style={{ boxShadow: '0 0 20px rgba(46, 204, 113, 0.1)' }}>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-military-accent" />
              <h2 className="text-military-accent font-black uppercase tracking-widest text-xs sm:text-sm">NET LOG</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono">
              {systemMessages.length === 0 ? (
                <p className="text-military-500">-- AWAITING TRAFFIC --</p>
              ) : (
                systemMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`px-2 sm:px-3 py-1 sm:py-2 border-l-2 lg:border-l-4 ${msg.type === 'talking'
                      ? 'bg-military-700 border-military-accent text-military-accent'
                      : msg.type === 'error'
                        ? 'bg-military-700 border-military-danger text-military-danger'
                        : 'bg-military-700 border-military-400 text-military-400'
                      }`}
                  >
                    <span className="hidden sm:inline">[{msg.timestamp.toLocaleTimeString()}]</span> {msg.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: PTT Control */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6 lg:py-0">
          <div className="bg-military-800 border-2 lg:border-4 border-military-accent p-6 sm:p-8 lg:p-12 text-center max-w-md w-full space-y-4 sm:space-y-6 lg:space-y-8"
            style={{ boxShadow: '0 0 40px rgba(46, 204, 113, 0.4)' }}>
            <div>
              <h3 className="text-military-accent text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-wider mb-2 sm:mb-3 lg:mb-4">PUSH-TO-TALK</h3>
              <p className="text-military-accent text-xs sm:text-sm font-mono tracking-widest">
                <span className="hidden sm:inline">HOLD SHIFT OR BUTTON</span>
                <span className="sm:hidden">HOLD BUTTON</span>
              </p>
            </div>

            {/* PTT Button */}
            <div className="flex flex-col items-center gap-4 sm:gap-6">
              <button
                disabled={speakingUsers.size > 0 && !isTalking}
                onMouseDown={handlePTTMouseDown}
                onMouseUp={handlePTTMouseUp}
                onMouseLeave={handlePTTMouseUp}
                onTouchStart={handlePTTTouchStart}
                onTouchEnd={handlePTTTouchEnd}
                className={`w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full flex items-center justify-center transition-all duration-200 border-4 lg:border-8 select-none ${speakingUsers.size > 0 && !isTalking
                  ? 'bg-gray-700 bg-opacity-30 border-gray-600 cursor-not-allowed opacity-50'
                  : isTalking
                    ? 'bg-military-danger bg-opacity-30 border-military-danger animate-pulse active:scale-95'
                    : 'bg-military-accent bg-opacity-20 border-military-accent active:scale-95 hover:bg-opacity-30'
                  }`}
                style={isTalking ? { boxShadow: '0 0 30px rgba(231, 76, 60, 0.6)' } :
                  speakingUsers.size > 0 && !isTalking ? { boxShadow: 'none' } :
                    { boxShadow: '0 0 30px rgba(46, 204, 113, 0.4)' }}
              >
                {isTalking ? (
                  <AudioWaves />
                ) : speakingUsers.size > 0 ? (
                  <LogOut className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-gray-500 rotate-180" /> // Using Icon to show receiving or blocked
                ) : (
                  <Mic2 className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-military-accent" />
                )}
              </button>
            </div>

            {/* Status Text */}
            <div>
              <p className="text-military-accent font-black text-lg sm:text-xl lg:text-2xl uppercase tracking-wider">
                {isTalking ? '▰ TRANSMITTING ▰' : speakingUsers.size > 0 ? '▰ RECEIVING ▰' : '◇ READY ◇'}
              </p>
              <p className="text-military-400 text-xs font-mono uppercase tracking-widest mt-2">
                {isTalking ? 'RELEASE TO STOP' : (
                  <span>
                    <span className="hidden sm:inline">PRESS & HOLD SHIFT OR BUTTON</span>
                    <span className="sm:hidden">PRESS & HOLD BUTTON</span>
                  </span>
                )}
              </p>
            </div>

            {/* PTT Denied Alert */}
            {pttDenied && (
              <div className="bg-military-danger bg-opacity-30 border-2 border-military-danger p-3 sm:p-4">
                <p className="text-military-danger font-black uppercase tracking-wider text-xs sm:text-sm">⚠ {pttDenied}</p>
              </div>
            )}

            {/* Connection Status */}
            <div className="text-xs font-mono uppercase tracking-widest">
              {connected ? (
                <p className="text-military-accent">✓ NETWORK ACTIVE</p>
              ) : (
                <p className="text-military-warning">⚠ CONNECTING...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-military-900 border-t-2 lg:border-t-4 border-military-accent px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-center text-military-accent text-xs font-mono uppercase tracking-widest"
        style={{ boxShadow: '0 -4px 15px rgba(46, 204, 113, 0.2)' }}>
        <span className="hidden sm:inline">▰▰▰ SINGLE CHANNEL • MAX 1 SPEAKER • ENCRYPTED TRANSMISSION ▰▰▰</span>
        <span className="sm:hidden">▰ ENCRYPTED ▰</span>
      </div>
    </div>
  );
}