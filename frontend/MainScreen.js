import React, { useState } from 'react';
import {
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './styles';
import SharedHeader from './SharedHeader'; // <-- Add this import

const MainScreen = ({ navigation, route }) => {
  const username = route.params?.username;
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState('Create');
  const [notification, setNotification] = useState('');
  const [joinKey, setJoinKey] = useState('');

  const handleOption = (option) => {
    setSelectedAction(option);
    setDropdownVisible(false);
    setNotification('');
  };

  const showNotification = (text, duration = 3000) => {
    setNotification(text);
    setTimeout(() => setNotification(''), duration);
  };

  const handlePrimaryAction = async () => {
    if (!username) {
      showNotification('Please enter your username.');
      return;
    }

    if (selectedAction === 'Create') {
      try {
        const response = await fetch('https://draw-n-go.azurewebsites.net/api/CreateSession', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-username': username,
          },
        });

        const data = await response.json();
        if (response.status === 201) {
          navigation.navigate('WaitingRoom', {
            sessionId: data.sessionId,
            username,
            isAdmin: true,
          });
        } else {
          showNotification(data.message || 'Failed to create session.');
        }
      } catch (err) {
        showNotification('Server error creating session.');
      }
    } else if (selectedAction === 'Join') {
      if (!joinKey) {
        showNotification('Enter a session ID or creator username.');
        return;
      }

      const body = joinKey.includes('-')
        ? { sessionId: joinKey }
        : { creator: joinKey };

      try {
        const response = await fetch('https://draw-n-go.azurewebsites.net/api/JoinSession', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-username': username,
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (response.status === 200) {
          navigation.navigate('WaitingRoom', {
            sessionId: data.sessionId,
            username,
            isAdmin: false,
          });
        } else {
          showNotification(data.message || 'Failed to join session.');
        }
      } catch (err) {
        showNotification('Server error joining session.');
      }
    }
  };

  const handleLogout = () => {
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SharedHeader navigation={navigation} username={username} />
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Main Screen</Text>
      </View>

      <View style={styles.actionContainer}>
        {selectedAction === 'Join' && (
          <TextInput
            style={styles.input}
            placeholder="Session ID or Creator"
            value={joinKey}
            onChangeText={setJoinKey}
            autoCapitalize="none"
          />
        )}

        <View style={styles.splitButtonRow}>
          <TouchableOpacity style={styles.splitButtonLeft} onPress={handlePrimaryAction}>
            <Text style={styles.buttonText}>{selectedAction}</Text>
          </TouchableOpacity>

          <View style={styles.splitButtonDivider} />

          <TouchableOpacity style={styles.splitButtonRight} onPress={() => setDropdownVisible(!dropdownVisible)}>
            <Ionicons name="chevron-down" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {dropdownVisible && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity onPress={() => handleOption('Create')}>
              <Text style={styles.dropdownItem}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleOption('Join')}>
              <Text style={styles.dropdownItem}>Join</Text>
            </TouchableOpacity>
          </View>
        )}

        {notification !== '' && (
          <View style={styles.notificationBanner}>
            <Text style={styles.notificationText}>{notification}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.button, { backgroundColor: '#d9534f', marginTop: 24 }]} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default MainScreen;
