import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import styles from './styles';

const SharedHeader = ({ navigation, showHome }) => (
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
    {/* Top left: either profile logo or home button */}
    {showHome ? (
      <TouchableOpacity onPress={() => navigation.navigate('Main')}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Home</Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity onPress={() => navigation.navigate('PlayerPage')}>
        <Image
          source={require('../assets/profile.png')}
          style={{ width: 32, height: 32 }}
          accessibilityLabel="Profile"
        />
      </TouchableOpacity>
    )}
    {/* Top right: Sign Out */}
    <TouchableOpacity onPress={() => navigation.replace('Entrance')}>
      <Text style={{ color: '#d9534f', fontWeight: 'bold', fontSize: 18 }}>Sign Out</Text>
    </TouchableOpacity>
  </View>
);

export default SharedHeader;