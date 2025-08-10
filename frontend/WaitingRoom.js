import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SignalR from '@microsoft/signalr';
import styles from './styles';
import AdminTemplateMap from './AdminTemplateMap';
import SharedHeader from './SharedHeader';

const WaitingRoom = ({ route, navigation }) => {
  const { sessionId, username, isAdmin } = route.params;

  const [users, setUsers] = useState([]);
  const [readyStatus, setReadyStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [startError, setStartError] = useState("");
  const [templateMsg, setTemplateMsg] = useState("");
  const [template, setTemplate] = useState(null); // { templateId, center, radiusMeters }
  const [myLocation, setMyLocation] = useState(null); // { latitude, longitude }

  const fetchGameEntity = async (gameId) => {
    try {
      const response = await fetch(
        `https://draw-n-go.azurewebsites.net/api/GetGame?gameId=${gameId}`
      );
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (err) {
      return null;
    }
  };

  // Get current location (for admin default center)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const { coords } = await (await import('expo-location')).getCurrentPositionAsync({});
        setMyLocation({ latitude: coords.latitude, longitude: coords.longitude });
      } catch (e) {}
    })();
  }, [isAdmin]);

  const fetchSession = async () => {
    if (!sessionId || !username) {
      setErrorMsg("Missing sessionId or username");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(
        `https://draw-n-go.azurewebsites.net/api/JoinSession?sessionId=${sessionId}`
      );
      if (!response.ok) {
        let errorMsg = 'Unknown error';
        let shouldKick = false;
        try {
          const errData = await response.json();
          errorMsg = errData.error || JSON.stringify(errData);
          // If session deleted, kick user out
          if (
            errorMsg.includes('Session not found') ||
            errorMsg.includes('Session deleted') ||
            response.status === 404
          ) {
            shouldKick = true;
          }
        } catch (e) {
          errorMsg = response.statusText;
        }
        setErrorMsg(errorMsg);
        setLoading(false);
        if (shouldKick) {
          navigation.navigate('Main', { username });
        }
        return;
      }
      const data = await response.json();
      setUsers(data.users || []);
      setReadyStatus(data.readyStatus || {});
      setCreator(data.creator || "");
      setErrorMsg("");
      setLoading(false);
      // Always update template from backend for all users
      setTemplate(data.template || null);
      if (data.isStarted && data.currentGameId) {
        navigation.navigate('Game', {
          sessionId,
          gameId: data.currentGameId,
          users: data.users,
          roles: data.roles,
          painter: data.painter,
          username,
          isAdmin,
          template: data.template || null
        });
      }
    } catch (err) {
      setErrorMsg("Network error or server unavailable.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 1000); // poll every 1 second
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', async () => {
        try {
          await fetch('https://draw-n-go.azurewebsites.net/api/JoinSession', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-username': username,
            },
            body: JSON.stringify({
              sessionId,
              leave: true,
            }),
          });
        } catch (err) {
          console.warn('Auto-leave failed:', err);
        }
      });
      return unsubscribe;
    }, [navigation, sessionId, username])
  );

  const handleToggleReady = async () => {
    if (!sessionId || !username) {
      setErrorMsg("Missing sessionId or username");
      return;
    }
    try {
      const isReady = readyStatus[username];
      await fetch('https://draw-n-go.azurewebsites.net/api/JoinSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': username
        },
        body: JSON.stringify({
          sessionId,
          setReady: !isReady
        }),
      });
      fetchSession();
    } catch (err) {
      setErrorMsg('Failed to toggle ready');
    }
  };

  const handleLeave = async () => {
    if (!sessionId || !username) {
      setErrorMsg("Missing sessionId or username");
      navigation.navigate('Main', { username });
      return;
    }
    try {
      const response = await fetch('https://draw-n-go.azurewebsites.net/api/JoinSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': username,
        },
        body: JSON.stringify({
          sessionId,
          leave: true,
        }),
      });
      if (!response.ok) {
        let errorMsg = 'Unknown error';
        try {
          const errData = await response.json();
          errorMsg = errData.error || JSON.stringify(errData);
        } catch (e) {
          errorMsg = response.statusText;
        }
        setErrorMsg(errorMsg);
      }
    } catch (err) {
      setErrorMsg("Failed to leave session");
    } finally {
      navigation.navigate('Main', { username });
    }
  };

  const allReady = users.length > 0 && users.every(user => readyStatus[user]);

  const handleStartGame = async () => {
    if (!allReady) {
      setStartError("All players must be ready to start the game.");
      return;
    }
    if (!sessionId || !username) {
      setStartError("Missing sessionId or username");
      return;
    }
    setStartError("");
    try {
      const response = await fetch('https://draw-n-go.azurewebsites.net/api/StartGame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) {
        let errorMsg = 'Failed to start game.';
        try {
          const errData = await response.json();
          errorMsg = errData.error || JSON.stringify(errData);
        } catch (e) {
          errorMsg = response.statusText;
        }
        setStartError(errorMsg);
      }
    } catch (err) {
      setStartError("Failed to start game.");
    }
  };

  // Admin sets the template (calls JoinSession POST with template info)
  const handleTemplateConfirm = async ({ templateId, center, radiusMeters }) => {
    try {
      setTemplateMsg('Saving template…');
      const res = await fetch('https://draw-n-go.azurewebsites.net/api/JoinSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': username,
        },
        body: JSON.stringify({
          sessionId,
          setTemplate: true,
          templateId,
          center,
          radiusMeters,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        setTemplateMsg(`Failed to save template: ${err}`);
      } else {
        setTemplateMsg('Template set ✅');
        fetchSession();
      }
    } catch (e) {
      setTemplateMsg('Failed to save template (network).');
    } finally {
      setTimeout(() => setTemplateMsg(''), 2000);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { flex: 1 }]}>      
      {/* Full-screen map */}
      <View style={{ flex: 1, position: 'relative' }}>
        <AdminTemplateMap
          onConfirm={isAdmin ? handleTemplateConfirm : undefined}
          initialRadiusMeters={120}
          initialCenter={isAdmin && myLocation ? myLocation : undefined}
          disabled={!isAdmin}
          template={template}
          hideControls={!isAdmin}
          height={'100%'}
        />

        {/* Overlay: top-left players list with ready status */}
        <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', padding: 10, borderRadius: 10, maxWidth: '80%' }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>Waiting Room • Session: {sessionId}</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#21a4d6" />
          ) : errorMsg ? (
            <Text style={{ color: 'red' }}>{errorMsg}</Text>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
                  <Text style={{ fontWeight: item === username ? '700' : '400', color: item === creator ? '#f39c12' : '#333' }}>
                    {item}{item === creator ? ' 👑' : ''}{item === username ? ' (you)' : ''}
                  </Text>
                  <Text style={{ marginLeft: 8 }}>
                    {readyStatus[item] ? '✅ Ready' : '⏳ Not Ready'}
                  </Text>
                </View>
              )}
            />
          )}
        </View>

        {/* Overlay: bottom-left smaller actions */}
        <View style={{ position: 'absolute', bottom: 16, left: 12, alignItems: 'flex-start', gap: 8 }}>
          <TouchableOpacity
            style={[styles.button, { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: readyStatus[username] ? '#20b265' : '#21a4d6', minWidth: 120 }]}
            onPress={handleToggleReady}
          >
            <Text style={[styles.buttonText, { fontSize: 14 }]}>
              {readyStatus[username] ? 'Ready ✅' : "I'm Ready"}
            </Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              style={[styles.button, { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: allReady ? '#20b265' : '#cccccc', minWidth: 120 }]}
              onPress={handleStartGame}
              disabled={!allReady}
            >
              <Text style={[styles.buttonText, { fontSize: 14 }]}>Start</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#d9534f', minWidth: 120 }]}
            onPress={handleLeave}
          >
            <Text style={[styles.buttonText, { fontSize: 14 }]}>{isAdmin ? 'End Session' : 'Leave'}</Text>
          </TouchableOpacity>

          {startError !== '' && (
            <Text style={[styles.error, { marginTop: 6 }]}>{startError}</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WaitingRoom;