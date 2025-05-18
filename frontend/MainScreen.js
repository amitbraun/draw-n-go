import React, { useState } from 'react';
import {
  Text,
  View,
  SafeAreaView,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './styles';

const MainScreen = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState('Create');
  const [notification, setNotification] = useState('');

  const handleOption = (option) => {
    setSelectedAction(option);
    setDropdownVisible(false);
  };

  const handlePrimaryAction = () => {
    setNotification(`${selectedAction} triggered`);
    setTimeout(() => setNotification(''), 3000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Main Screen</Text>
        <Text style={styles.placeholderText}>
          Your location-based features will appear here.
        </Text>
      </View>

      <View style={styles.actionContainer}>
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
      </View>
    </SafeAreaView>
  );
};

export default MainScreen;
