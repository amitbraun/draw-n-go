import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import styles from './styles';

const SharedHeader = ({ navigation, showHome, username, onSignOut, hideSignOut = false }) => (
  <View style={{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#21a4d6',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  }}>
    {/* Left section with possible create button */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {showHome ? (
        <TouchableOpacity onPress={() => navigation.navigate('Main')}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Home</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => navigation.navigate('PlayerPage', { username })}>
          <Image
            source={require('../assets/profile.png')}
            style={{ width: 32, height: 32 }}
            accessibilityLabel="Profile"
          />
        </TouchableOpacity>
      )}
  <TouchableOpacity onPress={() => navigation.navigate('Templates', { username })} style={{ marginLeft: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Templates</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('HighScores', { username })} style={{ marginLeft: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Hi-Scores</Text>
      </TouchableOpacity>
    </View>
    {/* Right: Sign Out */}
    {!hideSignOut && (
      <TouchableOpacity onPress={async () => {
        if (onSignOut) {
          try { await onSignOut(); } catch {}
        } else {
          navigation.replace('Entrance');
        }
      }}>
        <Text style={{ color: '#d9534f', fontWeight: 'bold', fontSize: 18 }}>Sign Out</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default SharedHeader;