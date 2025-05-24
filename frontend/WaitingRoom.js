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
import styles from './styles';

const WaitingRoom = ({ route, navigation }) => {
  const { sessionId, username, isAdmin } = route.params;

  const [users, setUsers] = useState([]);
  const [readyStatus, setReadyStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [hasPressedReady, setHasPressedReady] = useState(false);

  const fetchSession = async () => {
    try {
      const response = await fetch(
        `https://draw-and-go.azurewebsites.net/api/JoinSession?sessionId=${sessionId}`
      );
      const data = await response.json();
      setUsers(data.users || []);
      setReadyStatus(data.readyStatus || {});
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch session:', err);
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

  const handleReady = async () => {
    try {
      await fetch('https://draw-and-go.azurewebsites.net/api/JoinSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': username
        },
        body: JSON.stringify({
          sessionId,
          setReady: true
        }),
      });
      setHasPressedReady(true);
    } catch (err) {
      console.error('Failed to mark ready:', err);
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

  const handleStartGame = () => {
    navigation.navigate('Game', { sessionId, username });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Waiting Room</Text>
        <Text style={styles.placeholderText}>Session ID: {sessionId}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#21a4d6" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Text
              style={{
                ...styles.dropdownItem,
                fontWeight: item === username ? 'bold' : 'normal',
                color: readyStatus[item] ? 'green' : '#21a4d6'
              }}
            >
              {item} {item === username && ' (you)'} {readyStatus[item] ? '✅' : ''}
            </Text>
          )}
        />
      )}

      {!hasPressedReady && (
        <TouchableOpacity style={styles.button} onPress={handleReady}>
          <Text style={styles.buttonText}>I'm Ready</Text>
        </TouchableOpacity>
      )}

      {isAdmin && allReady && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#20b265' }]}
          onPress={handleStartGame}
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
