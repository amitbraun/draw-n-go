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

const WaitingRoom = ({ route, navigation }) => {
  const { sessionId, username, isAdmin } = route.params;

  const [users, setUsers] = useState([]);
  const [readyStatus, setReadyStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [startError, setStartError] = useState(""); // <-- add this line

  const fetchGameEntity = async (gameId) => {
    try {
      const response = await fetch(
        `https://draw-and-go.azurewebsites.net/api/GetGame?gameId=${gameId}`
      );
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (err) {
      return null;
    }
  };

  const fetchSession = async () => {
    try {
      const response = await fetch(
        `https://draw-and-go.azurewebsites.net/api/JoinSession?sessionId=${sessionId}`
      );
      if (!response.ok) {
        // Try to read error message from response
        let errorMsg = 'Unknown error';
        try {
          const errData = await response.json();
          errorMsg = errData.error || JSON.stringify(errData);
        } catch (e) {
          errorMsg = response.statusText;
        }
        console.error('Failed to fetch session:', errorMsg);

        setErrorMsg(errorMsg); // <-- set error message
        setLoading(false);
        return;
      }
      const data = await response.json();
      setUsers(data.users || []);
      setReadyStatus(data.readyStatus || {});
      setCreator(data.creator || "");
      setErrorMsg(""); // <-- clear error if successful
      setLoading(false);

      // --- If game started, navigate to Game screen with isAdmin ---
      if (data.isStarted && data.currentGameId) {
        navigation.navigate('Game', {
          sessionId,
          gameId: data.currentGameId,
          users: data.users,
          roles: data.roles,
          painter: data.painter,
          username,
          isAdmin // <-- pass isAdmin here
        });
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
      setErrorMsg("Network error or server unavailable.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 3000); // poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', async () => {
        try {
          await fetch('https://draw-and-go.azurewebsites.net/api/JoinSession', {
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
    try {
        const isReady = readyStatus[username];
        await fetch('https://draw-and-go.azurewebsites.net/api/JoinSession', {
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
        console.error('Failed to toggle ready:', err);
    }
  };

  const handleLeave = async () => {
    try {
      await fetch('https://draw-and-go.azurewebsites.net/api/JoinSession', {
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
      console.error('Failed to leave session:', err);
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
    setStartError(""); // clear any previous error

    try {
      await fetch('https://draw-and-go.azurewebsites.net/api/StartGame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (err) {
      setStartError("Failed to start game.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Waiting Room</Text>
        <Text style={styles.placeholderText}>Session ID: {sessionId}</Text>
      </View>

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
        <Text style={styles.buttonText}>Leave Session</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default WaitingRoom;
