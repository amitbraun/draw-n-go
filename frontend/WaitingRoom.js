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

const SHAPES = [
  { label: 'Circle', value: 'circle' },
  { label: 'Polygon', value: 'polygon' },
  { label: 'Rectangle', value: 'rectangle' },
  { label: 'Square', value: 'square' },
  { label: 'Triangle', value: 'triangle' },
];

const WaitingRoom = ({ route, navigation }) => {
  const { sessionId, username, isAdmin } = route.params;

  const [users, setUsers] = useState([]);
  const [readyStatus, setReadyStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [startError, setStartError] = useState("");
<<<<<<< HEAD
  const [templateMsg, setTemplateMsg] = useState("");
=======
  const [selectedShape, setSelectedShape] = useState(SHAPES[0].value);
>>>>>>> origin/main

  const fetchGameEntity = async (gameId) => {
    try {
      const response = await fetch(
        `https://draw-n-go.azurewebsites.net/api/GetGame?gameId=${gameId}`
      );
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

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
<<<<<<< HEAD
        let errTxt = 'Unknown error';
        try {
          const errData = await response.json();
          errTxt = errData.error || JSON.stringify(errData);
        } catch {
          errTxt = response.statusText;
        }
        console.error('Failed to fetch session:', errTxt);
        setErrorMsg(errTxt);
=======
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
>>>>>>> origin/main
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
      if (data.selectedShape && data.selectedShape !== selectedShape) {
        setSelectedShape(data.selectedShape);
      }

      if (data.isStarted && data.currentGameId) {
        navigation.navigate('Game', {
          sessionId,
          gameId: data.currentGameId,
          users: data.users,
          roles: data.roles,
          painter: data.painter,
          username,
<<<<<<< HEAD
          isAdmin
=======
          isAdmin,
          chosenShape: data.selectedShape || selectedShape,
>>>>>>> origin/main
        });
      }
    } catch (err) {
      setErrorMsg("Network error or server unavailable.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [selectedShape]);

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
<<<<<<< HEAD
      console.error('Failed to toggle ready:', err);
=======
      setErrorMsg('Failed to toggle ready');
>>>>>>> origin/main
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

  const handleShapeSelect = async (shapeValue) => {
    setSelectedShape(shapeValue);

    if (!sessionId) return;
    try {
      // Update the selectedShape in backend session entity
      await fetch('https://draw-n-go.azurewebsites.net/api/JoinSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': username,
        },
        body: JSON.stringify({
          sessionId,
          selectedShape: shapeValue,
        }),
      });
      // No need to immediately fetchSession() because polling will pick this up
    } catch (err) {
      console.warn("Failed to update selected shape:", err);
    }
  };

  const handleStartGame = async () => {
    if (!allReady) {
      setStartError("All players must be ready to start the game.");
      return;
    }
<<<<<<< HEAD
    setStartError("");

=======
    if (!sessionId || !username) {
      setStartError("Missing sessionId or username");
      return;
    }
    setStartError("");
>>>>>>> origin/main
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

  // For when admin sets the template
  const handleTemplateConfirm = async ({ templateId, center, radiusMeters }) => {
    try {
      setTemplateMsg('Saving template…');
      const res = await fetch('https://draw-n-go.azurewebsites.net/api/SetTemplate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': username,
        },
        body: JSON.stringify({
          sessionId,
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Waiting Room</Text>
        <Text style={styles.placeholderText}>Session ID: {sessionId}</Text>
      </View>

<<<<<<< HEAD
      {/* Map visible for everyone */}
      <View style={{ height: 300, marginHorizontal: 12, marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
        <AdminTemplateMap
          onConfirm={isAdmin ? handleTemplateConfirm : undefined} // only admins can save
          initialRadiusMeters={120}
          initialCenter={{ latitude: 32.0750, longitude: 34.8144 }} // fallback
        />
        {templateMsg ? (
          <View style={{ position: 'absolute', bottom: 8, left: 8, right: 8, alignItems: 'center' }}>
            <Text style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
              {templateMsg}
            </Text>
          </View>
        ) : null}
      </View>
=======
      {isAdmin && (
        <View style={{ margin: 12, alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>Choose a shape:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {SHAPES.map(shape => (
              <TouchableOpacity
                key={shape.value}
                style={{
                  padding: 8,
                  margin: 4,
                  borderWidth: 2,
                  borderColor: selectedShape === shape.value ? '#21a4d6' : '#ccc',
                  borderRadius: 8,
                  backgroundColor: selectedShape === shape.value ? '#e0f7fa' : '#fff',
                }}
                onPress={() => handleShapeSelect(shape.value)}
              >
                <Text style={{ color: '#21a4d6', fontWeight: selectedShape === shape.value ? 'bold' : 'normal' }}>{shape.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ marginTop: 6, color: '#21a4d6' }}>
            Selected: <Text style={{ fontWeight: 'bold' }}>{SHAPES.find(s => s.value === selectedShape)?.label}</Text>
          </Text>
        </View>
      )}

      {!isAdmin && (
        <View style={{ margin: 12, alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>Chosen shape for this game:</Text>
          <Text style={{ color: '#21a4d6', fontWeight: 'bold' }}>
            {SHAPES.find(s => s.value === selectedShape)?.label}
          </Text>
        </View>
      )}
>>>>>>> origin/main

      {loading ? (
        <ActivityIndicator size="large" color="#21a4d6" />
      ) : errorMsg ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'red', textAlign: 'center' }}>{errorMsg}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
              <Text
                style={{
                  ...styles.dropdownItem,
                  fontWeight: item === username ? 'bold' : 'normal',
                  color: readyStatus[item] ? 'green' : '#21a4d6'
                }}
              >
                {item}
                {item === creator && ' 👑'}
                {item === username && ' (you)'}
              </Text>
              <Text style={{ marginLeft: 8 }}>
                {readyStatus[item] ? '✅ Ready' : '⏳ Not Ready'}
              </Text>
            </View>
          )}
        />
      )}

      {startError !== "" && (
        <Text style={styles.error}>{startError}</Text>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: readyStatus[username] ? '#20b265' : '#21a4d6' }
        ]}
        onPress={handleToggleReady}
      >
        <Text style={styles.buttonText}>
          {readyStatus[username] ? "Ready ✅" : "I'm Ready"}
        </Text>
      </TouchableOpacity>

      {isAdmin && (
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: allReady ? '#20b265' : '#cccccc' }
          ]}
          onPress={handleStartGame}
          disabled={!allReady}
        >
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#d9534f' }]}
        onPress={handleLeave}
      >
        <Text style={styles.buttonText}>{isAdmin ? 'End Session' : 'Leave Session'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default WaitingRoom;
