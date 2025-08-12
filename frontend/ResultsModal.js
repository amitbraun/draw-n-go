import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import styles from './styles';

const ResultsModal = ({ visible, onClose, username }) => {
  // Dummy results data
  const results = [
    { username: "Alice", score: 12 },
    { username: "Bob", score: 9 },
    { username: "Charlie", score: 7 },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(28,28,30,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <View style={[styles.middlePlaceholder, { width: 340, padding: 24 }]}>
          <Text style={styles.title}>Game Results</Text>
          <Text style={styles.placeholderText}>
            Thanks for playing, <Text style={{ fontWeight: 'bold', color: '#4FD1C5' }}>{username}</Text>!
          </Text>
          <View style={[styles.actionContainer, { marginTop: 18 }]}>
            <Text style={{ color: '#A1A1AA', fontSize: 18, marginBottom: 12, fontWeight: 'bold' }}>
              Players & Scores
            </Text>
            {results.map((player, idx) => (
              <View
                key={player.username}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: idx < results.length - 1 ? 1 : 0,
                  borderBottomColor: '#232325',
                }}
              >
                <Text style={{ color: '#E5E5E7', fontSize: 16, fontWeight: '500' }}>
                  {player.username}
                </Text>
                <Text style={{ color: '#4FD1C5', fontSize: 16, fontWeight: 'bold' }}>
                  {player.score}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, { marginTop: 24 }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ResultsModal;